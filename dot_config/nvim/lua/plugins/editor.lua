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

  -- 1. Diffview: Fork / SourceTree style Visual Diff & File History
  {
    "sindrets/diffview.nvim",
    cmd = { "DiffviewOpen", "DiffviewClose", "DiffviewToggleFiles", "DiffviewFocusFiles", "DiffviewFileHistory" },
    keys = {
      { "<leader>gd", "<cmd>DiffviewOpen<cr>", desc = "Diffview Open (Project Diff)" },
      { "<leader>gh", "<cmd>DiffviewFileHistory %<cr>", desc = "Diffview File History (Current File)" },
    },
  },

  -- 2. Neogit: Buffer-native Git status & commit workflow
  {
    "NeogitOrg/neogit",
    dependencies = {
      "nvim-lua/plenary.nvim",
      "sindrets/diffview.nvim",
      "nvim-telescope/telescope.nvim",
    },
    opts = {
      integrations = {
        diffview = true,
        telescope = true,
      },
    },
    cmd = "Neogit",
    keys = {
      { "<leader>gn", "<cmd>Neogit<cr>", desc = "Neogit Status Panel" },
    },
  },

  -- 3. Grug-far: VSCode-style interactive global search and replace
  {
    "MagicDuck/grug-far.nvim",
    opts = { headerMaxWidth = 80 },
    cmd = "GrugFar",
    keys = {
      {
        "<leader>sr",
        function()
          require("grug-far").open()
        end,
        mode = { "n", "v" },
        desc = "Search and Replace (grug-far)",
      },
    },
  },
}

