import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

interface WorkspaceAuthorization {
  readonly version: 1;
  readonly parentRoot: string;
  readonly workspace: string;
  readonly change: string;
  readonly participants: readonly unknown[];
}

interface GuardPolicy {
  restricted(agentKind: string, agentName: string): boolean;
  captureAuthorization(messages: readonly unknown[]): WorkspaceAuthorization | undefined;
  evaluate(payload: {
    agentKind: string; agentName: string; cwd: string;
    authorization: WorkspaceAuthorization | undefined; toolName: string; input: unknown;
  }): { decision: "allow" } | { decision: "block"; reason: string };
}

export default function osWorktreeGuard(pi: ExtensionAPI) {
  const authorizations = new Map<string, WorkspaceAuthorization>();
  const failures = new Map<string, string>();
  let policy: GuardPolicy | undefined;
  let loadError: unknown;
  try { policy = require("./lib/worktree-guard.cjs"); } catch (error) { loadError = error; }
  const message = (error: unknown) => error instanceof Error ? error.message : String(error);
  // Spawn-time defects (bad authorization block, broken guard install) cannot be
  // repaired by the subagent; tell it to stop and escalate instead of probing.
  const fatal = (cause: string) =>
    `worktree-guard: FATAL, NOT RECOVERABLE BY THIS AGENT: ${cause}. ` +
    "This is a caller/spawn configuration defect, not a problem with your tool call. " +
    "Every tool call in this session will be blocked; retrying, rewording, switching tools, " +
    "or investigating files will not help. STOP NOW: make no further tool calls and end your turn " +
    "immediately, reporting this exact message to the caller (os-supervisor) so it can re-spawn you " +
    "with a valid <worktree-authorization> block or repair the guard installation.";
  const scoped = (ctx: { agent: { kind: string; name: string } }) => policy ? policy.restricted(ctx.agent.kind, ctx.agent.name) :
    ctx.agent.kind === "sub" && ["os-apply", "os-archive"].includes(ctx.agent.name);
  pi.on("context", (event, ctx) => {
    if (!scoped(ctx)) return;
    try {
      const id = ctx.sessionManager.getSessionId();
      if (authorizations.has(id) || failures.has(id)) return;
      if (loadError) throw loadError;
      if (!policy) throw new Error("guard policy unavailable");
      const authorization = policy.captureAuthorization(event.messages);
      if (authorization !== undefined) authorizations.set(id, authorization);
    } catch (error) {
      try { failures.set(ctx.sessionManager.getSessionId(), message(error)); } catch {}
    }
  });
  pi.on("tool_call", (event, ctx) => {
    if (!scoped(ctx)) return;
    let reason: string | undefined;
    try {
      const id = ctx.sessionManager.getSessionId();
      if (loadError) reason = fatal(`guard policy failed to load (${message(loadError)})`);
      else if (!policy) reason = fatal("guard policy unavailable");
      else if (failures.has(id)) reason = fatal(failures.get(id)!);
      else {
        const result = policy.evaluate({
          agentKind: ctx.agent.kind, agentName: ctx.agent.name, cwd: ctx.cwd,
          authorization: authorizations.get(id), toolName: event.toolName, input: event.input,
        });
        if (result.decision === "block") reason = result.reason;
      }
    } catch (error) { reason = `worktree-guard: policy error: ${message(error)}`; }
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
