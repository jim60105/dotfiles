import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const { evaluate } = require("./lib/protect-important-paths.cjs") as {
  evaluate: (payload: unknown) => any;
};

export default function protectImportantPaths(pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") {
      return;
    }

    const command =
      typeof (event.input as { command?: unknown }).command === "string"
        ? (event.input as { command: string }).command
        : "";

    if (!command) {
      return;
    }

    const result = evaluate({
      tool_input: { command },
      cwd: ctx.cwd,
    });

    const output = result?.hookSpecificOutput;

    if (output?.permissionDecision === "deny") {
      return {
        block: true,
        reason:
          output.permissionDecisionReason ??
          "Blocked by protect-important-paths policy",
      };
    }
  });
}
