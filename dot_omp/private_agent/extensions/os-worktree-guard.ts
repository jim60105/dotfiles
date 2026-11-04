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
      try { failures.set(ctx.sessionManager.getSessionId(), String(error)); } catch {}
    }
  });
  pi.on("tool_call", (event, ctx) => {
    if (!scoped(ctx)) return;
    let reason: string | undefined;
    try {
      if (loadError) throw loadError;
      if (!policy) throw new Error("guard policy unavailable");
      const id = ctx.sessionManager.getSessionId();
      if (failures.has(id)) throw new Error(failures.get(id));
      const result = policy.evaluate({
        agentKind: ctx.agent.kind, agentName: ctx.agent.name, cwd: ctx.cwd,
        authorization: authorizations.get(id), toolName: event.toolName, input: event.input,
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
