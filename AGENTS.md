# AGENTS.md — Dotfiles Repository

## Project Overview

Personal dotfiles managed by [Chezmoi](https://www.chezmoi.io/). This repository provisions shell, editor, Git, terminal emulator, and AI tooling configurations across multiple machines and environments (bare-metal Linux, devcontainers, and GitHub Codespaces).

**Owner:** Jim Chen  
**License:** GPL-3.0

## ⛔ CRITICAL SAFETY WARNING

**`chezmoi apply` directly modifies files in the user's home directory. This can cause irreversible damage — there is NO undo or rollback.**

- **NEVER** run `chezmoi apply`, `chezmoi init`, or any Create/Update/Delete operation without **explicit user confirmation**.
- **ALWAYS** use `chezmoi diff` or `chezmoi apply --dry-run` first to preview changes before applying.
- Treat every Chezmoi write operation as **destructive by default**.
- When in doubt, show the user the `--dry-run` output and ask for approval before proceeding.

## Chezmoi Reference

For complete and up-to-date documentation, always consult the **official Chezmoi reference** at:  
👉 <https://www.chezmoi.io/reference/>

Key reference pages:

- [Source state attributes](https://www.chezmoi.io/reference/source-state-attributes/) — prefix/suffix naming rules
- [Special files](https://www.chezmoi.io/reference/special-files/) — `.chezmoiignore`, `.chezmoi.toml.tmpl`, etc.
- [Templates](https://www.chezmoi.io/reference/templates/) — Go template syntax and behavior
- [Commands](https://www.chezmoi.io/reference/commands/) — CLI command reference (`chezmoi diff`, `chezmoi apply`, etc.)

### Source State Attributes

Chezmoi translates source-directory names into target paths using prefixes and suffixes. The **order of prefixes matters** — they must appear in the documented order.

**Prefixes:**

| Prefix | Effect |
|---|---|
| `after_` / `before_` | Run script after/before updating the destination |
| `create_` | Ensure that the file exists; create it with contents if it does not |
| `dot_` | Rename to use a leading dot (e.g., `dot_zshrc` → `.zshrc`) |
| `empty_` | Ensure the file exists, even if empty (by default, empty files are removed) |
| `encrypted_` | Encrypt the file in the source state |
| `exact_` | Remove anything not managed by Chezmoi |
| `executable_` | Add executable permissions to the target file |
| `external_` | Ignore attributes in child entries |
| `literal_` | Stop parsing prefix attributes |
| `modify_` | Treat the contents as a script that modifies an existing file |
| `once_` / `onchange_` | Only run the script if its contents have not run before (or changed) |
| `private_` | Remove all group and world permissions from the target |
| `readonly_` | Remove all write permissions from the target |
| `remove_` | Remove the file/symlink if it exists, or the directory if empty |
| `run_` | Treat the contents as a script to run |
| `symlink_` | Create a symlink instead of a regular file |

**Suffixes:**

| Suffix | Effect |
|---|---|
| `.tmpl` | Treat the contents as a Go template |
| `.literal` | Stop parsing suffix attributes |

**Do not rename files** without understanding these conventions — the prefix/suffix directly controls how Chezmoi deploys the file. When in doubt, consult the [source state attributes reference](https://www.chezmoi.io/reference/source-state-attributes/).

## Template Data (`.chezmoi.toml.tmpl`)

Templates use Go's [`text/template`](https://pkg.go.dev/text/template) syntax with Chezmoi extensions. See the [Chezmoi templates reference](https://www.chezmoi.io/reference/templates/) for details. Templates are executed with `missingkey=error` by default.

The following data keys are available (set during `chezmoi init`):

| Key | Description |
|---|---|
| `.devcontainer` | `true` inside VS Code devcontainers or Codespaces |
| `.codespaces` | `true` only inside GitHub Codespaces |
| `.chezmoi.hostname` | Machine hostname; used for per-host conditionals |
| `.name` / `.email` | Git identity |
| `.gitSigningKey` | GPG key ID for commit/tag signing |
| `.openaiBaseUrl` / `.openaiApiKey` | OpenAI-compatible API endpoint |
| `.githubPatForMcp` | GitHub PAT used by MCP server configs |

When editing `.tmpl` files, preserve existing Go template conditionals (`{{- if ... }}` / `{{- end }}`). Test changes with `chezmoi diff` or `chezmoi apply --dry-run`.

## Repository Layout

```
.
├── .chezmoi.toml.tmpl          # Chezmoi config template (data prompts, editor, sourceDir)
├── .chezmoiignore              # Files excluded from deployment (supports Go templates)
├── install.sh                  # Bootstrap script: installs Chezmoi, inits submodules, applies config
├── dot_zshrc.tmpl              # ZSH config — Zinit plugin manager, Powerlevel10k, plugins, env vars
├── dot_zsh/                    # ZSH completions and helpers
├── dot_p10k.zsh                # Powerlevel10k prompt configuration
├── dot_vimrc                   # Vim config with Vundle plugin manager
├── dot_gitconfig.tmpl          # Git config — GPG signing, per-host safe dirs, credential helpers
├── dot_config/
│   ├── aichat/                 # aichat CLI configuration
│   ├── codegpt/                # CodeGPT config and prompt templates
│   ├── containers/             # Podman containers.conf
│   ├── kitty/                  # Kitty terminal emulator
│   ├── mpv/                    # mpv media player
│   ├── nvim/                   # Neovim config (LazyVim framework)
│   │   ├── init.lua            # Entry point → loads config.lazy
│   │   ├── lua/config/         # Options, keymaps, autocmds, lazy.nvim bootstrap
│   │   └── lua/plugins/        # Plugin specs: editor, coding, copilot, ui
│   ├── autostart/              # Desktop autostart scripts
│   ├── input-remapper-2/       # Input device remapping presets
│   ├── plasma-workspace/       # KDE Plasma env/shutdown hooks
│   └── waveterm/               # WaveTerm AI terminal config
├── dot_codex/                  # OpenAI Codex CLI config and prompt templates
├── dot_agents/
│   └── symlink_skills          # Symlink pointing to copilot-prompt/skills
├── dot_local/
│   ├── bin/                    # User-local executables
│   └── share/                  # AdGuard CLI, color schemes
├── private_dot_gnupg/          # GPG configuration (private permissions)
└── external_copilot-prompt/    # Git submodule: jim60105/copilot-prompt
    ├── agents/                 # Agent instruction files (*.agent.md)
    ├── instructions/           # Path-specific Copilot instructions (*.instructions.md)
    └── skills/                 # Copilot CLI skills (symlinked into ~/.agents/skills)
```

## Key Technical Details

### Shell Environment

- **Shell:** ZSH with [Zinit](https://github.com/zdharma-continuum/zinit) plugin manager
- **Theme:** Powerlevel10k (classic powerline style)
- **Key plugins:** fzf, fzf-tab, zsh-autosuggestions, fast-syntax-highlighting, zsh-vi-mode
- **CLI tools installed via Zinit:** bat, eza, ripgrep, neovim, marp-cli, codex-cli, copilot-cli, opencode, deno, shellspec, zola, codegpt
- **Locale:** `zh_TW.UTF-8` (Traditional Chinese)

### Git Configuration

- GPG commit/tag signing enabled (disabled in Codespaces)
- Default branch: `master`
- Pull strategy: rebase
- Push: `autoSetupRemote = true`

### Neovim Configuration

- **Framework:** [LazyVim](https://www.lazyvim.org/) with [lazy.nvim](https://github.com/folke/lazy.nvim) package manager
- **Config location:** `dot_config/nvim/` → `~/.config/nvim/`
- **Colorscheme:** Catppuccin Mocha
- **File picker:** fzf-lua (LazyVim extra, uses fzf instead of fd/telescope)
- **Terminal:** toggleterm.nvim (`Ctrl+\` to toggle floating terminal)
- **AI:** GitHub Copilot via `github/copilot.vim`
- **Extras enabled:** yanky (yank history), mini-move (drag blocks), fzf (picker)
- **Migrated from:** legacy Vim config (`dot_vimrc`) — see `tmp/migration_report.md` for plugin mapping details
- **Lua config files:** `lua/config/options.lua` (vim options), `lua/config/keymaps.lua` (key mappings), `lua/config/autocmds.lua` (autocommands), `lua/plugins/*.lua` (plugin specs)

### Copilot-Prompt Submodule

The `external_copilot-prompt/` directory is a Git submodule (`jim60105/copilot-prompt`). It contains shared agent definitions, Copilot instructions, and skills. The `dot_agents/symlink_skills` file creates a symlink at `~/.agents/skills` → `~/copilot-prompt/skills`.

After modifying the submodule, run `chezmoi apply` to deploy changes.

## Setup & Validation

> **⚠️ WARNING:** `install.sh` is a **one-time bootstrap script** designed for machines where the `chezmoi` command is **not yet installed**. **NEVER execute `install.sh` on a machine where Chezmoi is already set up** — it will re-initialize the configuration and may overwrite your existing settings.

```bash
# Bootstrap from scratch (only on a fresh machine without chezmoi)
sh -c "$(curl -fsLS get.chezmoi.io)" -- init --apply $GITHUB_USERNAME
# Or use the install script (ONLY when chezmoi is not installed)
./install.sh

# --- Day-to-day operations (on machines with chezmoi already set up) ---

# Preview changes before applying
chezmoi diff

# Apply changes
chezmoi apply

# Dry-run (no writes)
chezmoi apply --dry-run

# Edit a managed file and apply
chezmoi edit ~/.zshrc
chezmoi apply
```

## Coding Guidelines

- **Comments and documentation:** Write in English.
- **Shell scripts:** Follow POSIX `sh` conventions where possible (`set -eu`). Use `#!/bin/sh` for install scripts; `#!/usr/bin/zsh` only for ZSH-specific files.
- **Templates:** Use Chezmoi's Go template syntax. Trim whitespace with `{{-` / `-}}` for clean output. Always test with `chezmoi diff` after changes.
- **Line endings:** LF only (enforced via `.gitattributes`).
- **Sensitive data:** Use `private_` prefix for files containing secrets. Never commit plaintext secrets — use Chezmoi's `promptStringOnce` or environment variables.
- **Machine-specific config:** Gate behind `{{ if eq .chezmoi.hostname "..." }}` or `{{ if .devcontainer }}` conditionals rather than creating separate files.
