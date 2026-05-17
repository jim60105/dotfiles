-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua

local map = vim.keymap.set

-- Window navigation with Meta+arrows (migrated from vimrc)
map("n", "<M-Right>", "<C-w>l", { desc = "Go to right window" })
map("n", "<M-Left>", "<C-w>h", { desc = "Go to left window" })
map("n", "<M-Up>", "<C-w>k", { desc = "Go to upper window" })
map("n", "<M-Down>", "<C-w>j", { desc = "Go to lower window" })
map("i", "<M-Right>", "<Esc><C-w>l", { desc = "Go to right window" })
map("i", "<M-Left>", "<Esc><C-w>h", { desc = "Go to left window" })
map("i", "<M-Up>", "<Esc><C-w>k", { desc = "Go to upper window" })
map("i", "<M-Down>", "<Esc><C-w>j", { desc = "Go to lower window" })

-- Save as sudo (migrated from vimrc)
vim.cmd([[cabbrev w!! w !sudo tee "%"]])
