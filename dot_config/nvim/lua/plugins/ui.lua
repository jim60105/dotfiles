return {
  -- Use Wombat-inspired dark colorscheme via catppuccin (replaces Wombat + fisa-vim-colorscheme)
  {
    "catppuccin/nvim",
    name = "catppuccin",
    priority = 1000,
    opts = {
      flavour = "mocha",
    },
  },

  {
    "AlexvZyl/nordic.nvim",
    name = "nordic",
    lazy = false,
    priority = 1000,
    config = function()
      -- Default visual.theme = 'dark' picks black0 (#191D24) and blends 85% with bg
      -- (gray0 #242933), making selections nearly invisible against the editor bg.
      -- Switch to the lighter palette (gray2 #3B4252) and reduce blending so the
      -- selected text background actually stands out.
      require("nordic").setup({
        visual = {
          theme = "light",
          blend = 0.7,
        },
      })
      require("nordic").load()
    end,
  },

  -- Set catppuccin as the default colorscheme
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "nordic",
    },
  },
}
