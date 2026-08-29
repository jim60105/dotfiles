return {
  -- pi-nvim: bridge between the pi coding agent and Neovim.
  -- Run pi in one terminal pane and Neovim in another; send files, selections,
  -- and prompts into the running pi session over a unix socket.
  -- Socket discovery is automatic: the pi extension writes to
  -- /tmp/pi-nvim-sockets/ and the plugin prefers sessions matching the cwd.
  -- Requires the pi-side extension: `pi install npm:pi-nvim`
  -- https://github.com/carderne/pi-nvim
  {
    "carderne/pi-nvim",
    lazy = false, -- setup() registers :Pi* commands and keymaps at startup
    opts = {
      socket_path = nil, -- auto-discover via /tmp/pi-nvim-sockets
      -- Keymaps are declared in `keys` below instead, so the plugin does not
      -- install a competing <leader>p mapping outside lazy.nvim.
      set_default_keymaps = false,
    },
    keys = {
      -- Plain `:` (not `<cmd>`) so a visual selection is passed as a range to :Pi.
      { "<leader>p", ":Pi<cr>", mode = { "n", "v" }, desc = "Send to pi" },
      { "<leader>pp", "<cmd>PiSend<cr>", desc = "Send prompt to pi" },
      { "<leader>pf", "<cmd>PiSendFile<cr>", desc = "Send current file to pi" },
      { "<leader>ps", "<cmd>PiSendSelection<cr>", mode = { "n", "v" }, desc = "Send selection to pi" },
      { "<leader>pb", "<cmd>PiSendBuffer<cr>", desc = "Send entire buffer to pi" },
      { "<leader>pi", "<cmd>PiPing<cr>", desc = "Ping the pi session" },
    },
  },
}
