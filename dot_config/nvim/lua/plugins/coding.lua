return {
  -- emmet-vim: HTML/CSS emmet expansion (kept from vimrc, still best option)
  {
    "mattn/emmet-vim",
    ft = { "html", "css", "javascript", "typescript", "vue", "svelte", "jsx", "tsx", "htmldjango" },
  },

  -- Treesitter: ensure common parsers are installed (replaces pangloss/vim-javascript,
  -- othree/javascript-libraries-syntax.vim, c.vim, etc.)
  {
    "nvim-treesitter/nvim-treesitter",
    opts = function(_, opts)
      vim.list_extend(opts.ensure_installed, {
        "bash",
        "c",
        "cpp",
        "css",
        "html",
        "javascript",
        "json",
        "lua",
        "markdown",
        "markdown_inline",
        "python",
        "query",
        "regex",
        "tsx",
        "typescript",
        "vim",
        "vimdoc",
        "xml",
        "yaml",
      })
    end,
  },
}
