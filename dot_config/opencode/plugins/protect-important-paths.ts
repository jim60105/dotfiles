import type { Plugin } from "@opencode-ai/plugin";
import { evaluate } from "../hooks/protect-important-paths";

export const ProtectImportantPathsPlugin: Plugin = async (ctx) => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool === "bash") {
        const command = output.args.command;
        const cwd = (ctx as any)?.directory || process.cwd();

        const payload = {
          tool_input: { command },
          cwd,
        };

        const result = evaluate(payload);
        if (result && result.hookSpecificOutput?.permissionDecision === "deny") {
          throw new Error(result.hookSpecificOutput.permissionDecisionReason);
        }
      }
    },
  };
};

export default ProtectImportantPathsPlugin;
