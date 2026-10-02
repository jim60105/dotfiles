import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

// The @mporenta/pi-claude-code plugin registers these four tools. Subagents
// are forbidden from using them; interactive sessions keep them (ctx.hasUI).
const CLAUDE_CODE_TOOLS: Record<string, true> = {
  spawn_claude_code: true,
  get_claude_code_run: true,
  list_claude_code_runs: true,
  stop_claude_code_run: true,
};

export default function blockClaudeCodeSubagents(pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (!(event.toolName in CLAUDE_CODE_TOOLS)) {
      return;
    }

    if (ctx.hasUI) {
      return;
    }

    return {
      block: true,
      reason:
        `Claude Code delegation is forbidden for subagents: ` +
        `"${event.toolName}" is blocked by policy. Do not retry this tool ` +
        `or attempt to work around the block; finish the task with your ` +
        `other tools, or report that it cannot be completed without ` +
        `Claude Code.`,
    };
  });
}
