import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";

const require = createRequire(import.meta.url);

export default function osWorktreeGuard(pi: ExtensionAPI) {
  const leases = new Map<string, string | null>();
  const failures = new Map<string, string>();
  const roots = new Map<string, { repoRoot: string; isOpenSpec: boolean }>();
  let policy: any;
  let loadError: unknown;
  try { policy = require("./lib/worktree-guard.cjs"); } catch (error) { loadError = error; }
  const scoped = (ctx: any) => policy ? policy.restricted(ctx.agent.kind, ctx.agent.name) :
    ctx.agent.kind === "sub" && ["os-apply", "os-archive"].includes(ctx.agent.name);
  pi.on("context", (event, ctx) => {
    if (!scoped(ctx)) return;
    try {
      const id = ctx.sessionManager.getSessionId();
      if (leases.has(id) || failures.has(id)) return;
      if (loadError) throw loadError;
      const lease = policy.captureLease(event.messages);
      if (lease !== undefined) leases.set(id, lease);
    } catch (error) {
      try { failures.set(ctx.sessionManager.getSessionId(), String(error)); } catch {}
    }
  });
  pi.on("tool_call", (event, ctx) => {
    if (!scoped(ctx)) return;
    let reason: string | undefined;
    try {
      if (loadError) throw loadError;
      const id = ctx.sessionManager.getSessionId();
      if (failures.has(id)) throw new Error(failures.get(id));
      let scope = roots.get(ctx.cwd);
      if (!scope) {
        const sh = (args: string[]) => execFileSync("git", ["-C", ctx.cwd, ...args], {
          encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 4000,
        }).trim();
        let top = "";
        try { top = sh(["rev-parse", "--show-toplevel"]); } catch {}
        let root = top;
        if (top) {
          const common = sh(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
          if (basename(common) === ".git") root = dirname(common);
        }
        scope = { repoRoot: root, isOpenSpec: !!root &&
          existsSync(join(root, "openspec")) && existsSync(join(root, ".worktrees")) };
        roots.set(ctx.cwd, scope);
      }
      const result = policy.evaluate({
        agentKind: ctx.agent.kind, agentName: ctx.agent.name, cwd: ctx.cwd,
        ...scope, lease: leases.get(id), toolName: event.toolName, input: event.input,
      });
      if (result.decision === "block") reason = result.reason;
    } catch (error) { reason = `worktree-guard: policy error: ${String(error)}`; }
    if (reason) {
      try {
        pi.logger.warn(JSON.stringify({
          extension: "os-worktree-guard", agent: ctx.agent.name,
          tool: event.toolName, reason,
        }));
      } catch {}
      return { block: true, reason };
    }
  });
}
