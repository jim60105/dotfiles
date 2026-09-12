import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * os-git-discipline — best-effort mechanical guard for the OpenSpec pipeline.
 *
 * Scope: repos whose git root contains openspec/ (an "OpenSpec repo"). Outside
 * that scope everything is log-only unless OMP_OS_GUARD forces a mode. This is
 * a DETERRENT against a drifting LLM, not a security boundary: it inspects the
 * bash command string, so exotic shells/scripts can evade it. The os-archive
 * worker carries an independent merge-proof preflight as the second layer.
 *
 * Modes (env OMP_OS_GUARD, read per call): block | log (default) | off.
 *
 * Laws (OpenSpec repos only):
 *  L1 merge into the primary branch (master/main) without --no-ff;
 *  L2 destructive cleanup of UNMERGED feat/* work: branch -D <feat/* unmerged>,
 *     worktree remove --force <worktree whose branch is unmerged>,
 *     git reset --hard at the primary root while any feat/* is unmerged;
 *  L3 direct `git commit` while HEAD is the primary branch (everything goes
 *     through a feature branch), except merge continuations (MERGE_HEAD set).
 *
 * Every block reason points at `os-phase --all` as the state oracle.
 */

type Mode = "block" | "log" | "off";

const PRIMARY: Record<string, true> = { master: true, main: true };
const GIT = /(?:^|[\s;&|(])(?:git|gh)\b/;

function sh(gitDir: string, args: string[]): string {
  try {
    return execFileSync("git", ["-C", gitDir, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 4000,
    }).trim();
  } catch {
    return "";
  }
}

function repoRoot(cwd: string, cmd: string): string | null {
  // Honor the last `git -C <path>` form in the segment (matches git's own last-wins).
  let root = cwd;
  const re = /git(?:\s+--?\S+)*?\s+-C\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cmd))) {
    const p = m[1] ?? m[2] ?? m[3] ?? "";
    root = p.startsWith("/") ? p : join(root, p);
  }
  const top = sh(root, ["rev-parse", "--show-toplevel"]);
  return top || null;
}

function headBranch(root: string): string {
  return sh(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
}

function isUnmergedFeat(root: string, branch: string): boolean {
  if (!branch.startsWith("feat/")) return false;
  if (!sh(root, ["rev-parse", "--verify", "-q", branch])) return false;
  const hb = headBranch(root);
  const primary = PRIMARY[hb]
    ? headBranch(root)
    : sh(root, ["rev-parse", "--verify", "-q", "master"])
      ? "master"
      : "main";
  try {
    execFileSync("git", ["-C", root, "merge-base", "--is-ancestor", branch, primary], {
      stdio: "ignore",
      timeout: 4000,
    });
    return false; // ancestor → merged
  } catch {
    return true;
  }
}

function unmergedFeatBranches(root: string): string[] {
  const out = sh(root, ["for-each-ref", "--format=%(refname:short)", "refs/heads/feat/"]);
  return out ? out.split("\n").filter((b) => isUnmergedFeat(root, b.trim())) : [];
}

function evaluate(cmd: string, cwd: string): string | null {
  const root = repoRoot(cwd, cmd);
  if (!root) return null;
  const head = headBranch(root);
  let curRoot = root;
  let curHead = head;
  const segments = cmd.split(/(?:&&|\|\||;|\n)/g).map((s) => s.trim()).filter(Boolean);

  for (const seg of segments) {
    // In-chain state simulation: later segments see earlier cd/checkout/switch.
    const cdTo = seg.match(/(?:^|\s)(?:cd|pushd)\s+(?!-)(["']?)([^\s;&|]+)\1(?:\s|$)/)?.[2];
    if (cdTo && !cdTo.startsWith("-")) {
      const next = cdTo.startsWith("/") ? cdTo : join(curRoot, cdTo);
      const top = sh(next, ["rev-parse", "--show-toplevel"]);
      if (top) {
        curRoot = top;
        curHead = headBranch(top);
      }
    }
    if (/\bgit\b/.test(seg) && /(?:^|\s)(?:checkout|switch)(?:\s+-[bBcC])?\s+(?!-|--)(\S+)/.test(seg)) {
      const branch = seg.match(/(?:^|\s)(?:checkout|switch)(?:\s+-[bBcC])?\s+(?!-|--)(\S+)/)?.[1] ?? "";
      if (branch && branch !== "-" && !branch.includes("/.git") && !/^\.{1,2}\//.test(branch)) curHead = branch;
    }
    const segRoot = (() => {
      const re = /git(?:\s+--?\S+)*?\s+-C\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|]+))/g;
      let r = curRoot;
      let m: RegExpExecArray | null;
      while ((m = re.exec(seg))) r = (m[1] ?? m[2] ?? m[3] ?? "").startsWith("/") ? (m[1] ?? m[2] ?? m[3])! : join(r, m[1] ?? m[2] ?? m[3] ?? "");
      const top = sh(r, ["rev-parse", "--show-toplevel"]);
      if (top) return top;
      return r;
    })();
    const head = curHead;

    if (!GIT.test(seg)) continue;

    // L1: merge into primary without --no-ff (includes --ff-only = the incident shape).
    if (/\bgit\b/.test(seg) && /(?:^|\s)merge(?:\s|$)/.test(seg) && !/--no-ff\b/.test(seg)) {
      if (PRIMARY[head] && PRIMARY[headBranch(segRoot)]) return `L1: merging into ${head} requires --no-ff (OpenSpec pipeline topology).`;
    }

    // L3: direct commit on primary branch, except a merge continuation.
    if (/\bgit\b/.test(seg) && /(?:^|\s)commit(?:\s|$)/.test(seg) && PRIMARY[head]) {
      const gitDir = sh(segRoot, ["rev-parse", "--git-dir"]);
      const mergeHead = gitDir ? existsSync(join(segRoot, gitDir, "MERGE_HEAD")) : false;
      if (!mergeHead && !existsSync(join(segRoot, ".git", "MERGE_HEAD")))
        return `L3: direct commit on ${head} is not allowed here; land changes via feat/<change> + merge --no-ff.`;
    }

    // L2a: branch -D on an unmerged feat/*
    if (/\bgit\b/.test(seg) && /(?:^|\s)branch\s+(-D|--delete)\b/.test(seg) && !/(?:^|\s)-d\b/.test(seg)) {
      const target = seg.match(/branch\s+(?:-D|--delete)\s+(\S+)/)?.[1];
      if (target && isUnmergedFeat(curRoot, target))
        return `L2: branch -D ${target} refused — unmerged into ${head}.`;
    }

    // L2b: worktree remove --force whose branch is unmerged
    if (/\bgit\b/.test(seg) && /worktree\s+remove\b/.test(seg) && /--force\b/.test(seg)) {
      const target = seg.match(/worktree\s+remove\b[^\n]*?\s+(?!-)([^\s;&|]+)/)?.[1];
      if (target) {
        const wt = target.startsWith("/") ? target : join(curRoot, target);
        const wtBranch = sh(wt, ["rev-parse", "--abbrev-ref", "HEAD"]);
        if (isUnmergedFeat(curRoot, wtBranch))
          return `L2: worktree ${target} owns unmerged ${wtBranch}; merge first.`;
      }
    }

    // L2c: reset --hard at primary root while anything is unmerged
    if (/\bgit\b/.test(seg) && /(?:^|\s)reset\s+--hard\b/.test(seg) && PRIMARY[head] && PRIMARY[headBranch(curRoot)]) {
      const pending = unmergedFeatBranches(curRoot);
      if (pending.length)
        return `L2: reset --hard on ${head} refused — unmerged: ${pending.join(", ")}.`;
    }

    // The FF-into-primary incident form: merge --ff-only handled by L1; gh merge has no --no-ff guarantee.
    if (/\bgh\b/.test(seg) && /(?:^|\s)merge\b/.test(seg) && PRIMARY[head] && PRIMARY[headBranch(curRoot)])
      return `L1: gh merge into ${head} bypasses the --no-ff law; merge locally.`;
  }
  return null;
}

export default function osGitDiscipline(pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return;
    const cmd = (event.input as { command?: unknown }).command;
    if (typeof cmd !== "string" || !cmd || !GIT.test(cmd)) return;

    const envMode = (process.env.OMP_OS_GUARD ?? "log").trim().toLowerCase();
    const m: Mode = envMode === "block" || envMode === "off" ? (envMode as Mode) : "log";
    if (m === "off") return;

    const root = repoRoot(ctx.cwd, cmd);
    const openspecRepo = root ? existsSync(join(root, "openspec")) : false;
    if (!openspecRepo) return; // not pipeline-managed: stay silent entirely unless forced

    const hit = evaluate(cmd, ctx.cwd);
    if (!hit) return;
    const reason = `os-git-discipline: ${hit} State oracle: os-phase --all (repo ${root}).`;

    if (m === "block") return { block: true, reason };
    ctx.notify?.("os-git-discipline [log-only]", reason, "warn");
  });
}
