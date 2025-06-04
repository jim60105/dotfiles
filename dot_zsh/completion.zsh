zinit wait lucid for \
  atinit"zicompinit; zicdreplay"  \
  blockf \
    zsh-users/zsh-completions

zinit add-fpath "$HOME/.zsh/completion"

# eza
zinit ice as"completion"
zinit snippet https://github.com/eza-community/eza/blob/main/completions/zsh/_eza

# ffmpeg
zinit ice as"completion"
zinit snippet https://github.com/zsh-users/zsh/blob/master/Completion/Unix/Command/_ffmpeg

# dotnet
zinit ice lucid nocompile
zinit light MenkeTechnologies/zsh-dotnet-completion

# chezmoi
zinit ice as"completion" mv"chezmoi.zsh -> _chezmoi"
zinit snippet https://github.com/twpayne/chezmoi/blob/master/completions/chezmoi.zsh

# yt-dlp
zinit ice wait"0" lucid from"gh-r" as"completion" \
    bpick"yt-dlp.tar.gz" \
    extract"" \
    mv"yt-dlp/completions/zsh/_yt-dlp -> _yt-dlp"
zinit light yt-dlp/yt-dlp

# talosctl, kubectl, oc, helm, docker, podman, skopeo
zinit ice wait lucid atinit"
  [[ -x \$(command -v talosctl) && ! -f \$HOME/.zsh/completion/_talosctl ]] && talosctl completion zsh > \$HOME/.zsh/completion/_talosctl
  [[ -x \$(command -v kubectl) && ! -f \$HOME/.zsh/completion/_kubectl ]] && kubectl completion zsh > \$HOME/.zsh/completion/_kubectl
  [[ -x \$(command -v oc) && ! -f \$HOME/.zsh/completion/_oc ]] && oc completion zsh > \$HOME/.zsh/completion/_oc
  [[ -x \$(command -v helm) && ! -f \$HOME/.zsh/completion/_helm ]] && helm completion zsh > \$HOME/.zsh/completion/_helm
  [[ -x \$(command -v docker) && ! -f \$HOME/.zsh/completion/_docker ]] && docker completion zsh > \$HOME/.zsh/completion/_docker
  [[ -x \$(command -v podman) && ! -f \$HOME/.zsh/completion/_podman ]] && podman completion zsh > \$HOME/.zsh/completion/_podman
  [[ -x \$(command -v skopeo) && ! -f \$HOME/.zsh/completion/_skopeo ]] && skopeo completion zsh > \$HOME/.zsh/completion/_skopeo
"
zinit snippet /dev/null

# codegpt
zinit ice wait lucid atinit"
  [[ -x \$(command -v codegpt) && ! -f \$HOME/.zsh/completion/_codegpt ]] && codegpt completion zsh > \$HOME/.zsh/completion/_codegpt
"
zinit snippet /dev/null

# codex-cli
zinit ice wait lucid atinit"
  [[ -x \$(command -v codex) && ! -f \$HOME/.zsh/completion/_codex ]] && codex completion zsh > \$HOME/.zsh/completion/_codex
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
