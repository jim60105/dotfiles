return {
  -- nvim-colorizer: paint CSS colors with real color (replaces lilydjwg/colorizer)
  {
    "norcalli/nvim-colorizer.lua",
    event = "BufReadPost",
    opts = {
      "*",
      css = { css = true },
      html = { names = false },
    },
  },

  -- toggleterm.nvim: terminal in neovim (replaces rosenfeld/conque-term)
  {
    "akinsho/toggleterm.nvim",
    version = "*",
    opts = {
      open_mapping = [[<c-\>]],
      direction = "float",
      insert_mappings = true,
      terminal_mappings = true,
      float_opts = {
        border = "curved",
      },
    },
  },
}
