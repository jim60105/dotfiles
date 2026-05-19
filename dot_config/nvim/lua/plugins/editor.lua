return {
  -- snacks.nvim: show hidden/dot files by default in the explorer
  {
    "folke/snacks.nvim",
    opts = {
      picker = {
        sources = {
          explorer = {
            hidden = true,
            ignored = true,
          },
        },
      },
    },
  },

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

  -- markview.nvim: Markdown/HTML/LaTeX/Typst/YAML previewer
  -- Do not lazy-load: plugin handles its own lazy loading internally
  {
    "OXY2DEV/markview.nvim",
    lazy = false,
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
