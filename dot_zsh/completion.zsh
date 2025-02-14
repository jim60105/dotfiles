zinit wait lucid for \
  atinit"zicompinit; zicdreplay"  \
  blockf \
    zsh-users/zsh-completions

zinit add-fpath "$HOME/.zsh/completion"

# eza
zinit ice as"completion"
zinit snippet https://github.com/eza-community/eza/blob/main/completions/zsh/_eza

# dotnet
zinit ice lucid nocompile
zinit light MenkeTechnologies/zsh-dotnet-completion

# chezmoi
zinit ice as"completion" mv"chezmoi.zsh -> _chezmoi"
zinit snippet https://github.com/twpayne/chezmoi/blob/master/completions/chezmoi.zsh

# talosctl, kubectl, oc
zinit ice wait lucid atinit"
  [[ -x \$(command -v talosctl) ]] && talosctl completion zsh > \$HOME/.zsh/completion/_talosctl
  [[ -x \$(command -v kubectl) ]] && kubectl completion zsh > \$HOME/.zsh/completion/_kubectl
  [[ -x \$(command -v oc) ]] && oc completion zsh > \$HOME/.zsh/completion/_oc
"
zinit snippet /dev/null

zstyle ':completion:*' completer _expand _complete _ignored
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Z}'
zstyle ':completion:*' menu no
zstyle ':completion:*' select-prompt '%SScrolling active: current selection at %p%s'
zstyle ':completion:*:descriptions' format '[%d]'
zstyle ':completion:*:processes' command 'ps -au$USER'
zstyle ':completion:complete:*:options' sort false
zstyle ':fzf-tab:complete:_zlua:*' query-string input
zstyle ':completion:*:*:*:*:processes' command "ps -u $USER -o pid,user,comm,cmd -w -w"
zstyle ':fzf-tab:complete:kill:argument-rest' extra-opts --preview=$extract'ps --pid=$in[(w)1] -o cmd --no-headers -w -w' --preview-window=down:3:wrap
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'eza -1 --color=always $realpath'
zstyle ':fzf-tab:*' fzf-flags --color=fg:1,fg+:2 --bind=tab:accept
zstyle ":completion:*:git-checkout:*" sort false
zstyle ':completion:*' list-colors ${(s.:.)LS_COLORS}
