#########################################################################
# P10K INSTANT PROMPT
#########################################################################
# Enable Powerlevel10k instant prompt. Should stay close to the top of ~/.zshrc.
# Initialization code that may require console input (password prompts, [y/n]
# confirmations, etc.) must go above this block; everything else may go below.
if [[ -r "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME/.cache}/p10k-instant-prompt-${(%):-%n}.zsh"
fi

#########################################################################
# ZINIT
#########################################################################
### Added by Zinit's installer
if [[ ! -f $HOME/.local/share/zinit/zinit.git/zinit.zsh ]]; then
    print -P "%F{33} %F{220}Installing %F{33}ZDHARMA-CONTINUUM%F{220} Initiative Plugin Manager (%F{33}zdharma-continuum/zinit%F{220})…%f"
    command mkdir -p "$HOME/.local/share/zinit" && command chmod g-rwX "$HOME/.local/share/zinit"
    command git clone https://github.com/zdharma-continuum/zinit "$HOME/.local/share/zinit/zinit.git" && \
        print -P "%F{33} %F{34}Installation successful.%f%b" || \
        print -P "%F{160} The clone has failed.%f%b"
fi

source "$HOME/.local/share/zinit/zinit.git/zinit.zsh"
autoload -Uz _zinit
(( ${+_comps} )) && _comps[zinit]=_zinit
### End of Zinit's installer chunk

#########################################################################
# THEME
#########################################################################
# P10K
zinit ice depth=1; zinit light romkatv/powerlevel10k

#########################################################################
# PLUGINS
#########################################################################

# FZF
zinit ice from="gh-r" as="command" bpick="*linux_amd64*"
zinit light junegunn/fzf
# FZF BYNARY AND TMUX HELPER SCRIPT
zinit ice lucid wait'0c' as="command" id-as="junegunn/fzf-tmux" pick="bin/fzf-tmux"
zinit light junegunn/fzf
# BIND MULTIPLE WIDGETS USING FZF
zinit ice lucid wait'0c' multisrc"shell/{completion,key-bindings}.zsh" id-as="junegunn/fzf_completions" pick="/dev/null"
zinit light junegunn/fzf
# FZF-TAB
zinit ice wait="1" lucid
zinit light Aloxaf/fzf-tab

# AUTOSUGGESTIONS, TRIGGER PRECMD HOOK UPON LOAD
ZSH_AUTOSUGGEST_BUFFER_MAX_SIZE=20
zinit ice wait="0a" lucid atload="_zsh_autosuggest_start"
zinit light zsh-users/zsh-autosuggestions
# ENHANCD
zinit ice wait="0b" lucid
zinit light b4b4r07/enhancd
export ENHANCD_FILTER=fzf:fzy:peco

# bat
zinit ice wait"0" lucid from"gh-r" as"program" \
    bpick"*x86_64-unknown-linux-gnu.tar.gz" \
    extract"" \
    mv"bat*/bat -> bat"
zinit light sharkdp/bat

# COMPLETIONS
if [[ -r "${XDG_CACHE_HOME:-$HOME}/.zsh/completion.zsh" ]]; then
  source "${XDG_CACHE_HOME:-$HOME}/.zsh/completion.zsh"
fi

# SYNTAX HIGHLIGHTING
zinit ice wait="0c" lucid atinit="zpcompinit;zpcdreplay"
zinit light zdharma-continuum/fast-syntax-highlighting

# ZSH-VI-MODE
zinit light jeffreytse/zsh-vi-mode

#########################################################################
# HISTORY
#########################################################################
[ -z "$HISTFILE" ] && HISTFILE="$HOME/.zhistory"
HISTSIZE=290000
SAVEHIST=$HISTSIZE
HISTFILE=~/.histfile

#########################################################################
# SETOPT
#########################################################################
setopt extended_history       # record timestamp of command in HISTFILE
setopt hist_expire_dups_first # delete duplicates first when HISTFILE size exceeds HISTSIZE
setopt hist_ignore_all_dups   # ignore duplicated commands history list
setopt hist_ignore_space      # ignore commands that start with space
setopt hist_verify            # show command with history expansion to user before running it
setopt inc_append_history     # add commands to HISTFILE in order of execution
setopt share_history          # share command history data
setopt always_to_end          # cursor moved to the end in full completion
setopt hash_list_all          # hash everything before completion
setopt always_to_end          # when completing from the middle of a word, move the cursor to the end of the word
setopt complete_in_word       # allow completion from within a word/phrase
setopt nocorrect                # spelling correction for commands
setopt list_ambiguous         # complete as much of a completion until it gets ambiguous.
setopt nolisttypes
setopt listpacked
setopt automenu
unsetopt BEEP
setopt vi

#########################################################################
# ENV VARIABLE
#########################################################################
export EDITOR='vim'
export VISUAL=$EDITOR
export PAGER='less'
export SHELL='/usr/bin/zsh'
export LANG='zh_TW.UTF-8'
export LC_ALL='zh_TW.UTF-8'
export XMODIFIERS=@im=fcitx

#########################################################################
# FZF SETTINGS
#########################################################################
export FZF_DEFAULT_OPTS="
--ansi
--style full
--layout=default
--info=inline
--color bg+:-1,gutter:-1
--height=50%
--multi
--preview-window=right:50%
--preview-window=sharp
--preview-window=cycle
--preview '([[ -f {} ]] && (bat --style=numbers --color=always --line-range :500 {} || cat {})) || ([[ -d {} ]] && (tree -C {} | less)) || echo {} 2> /dev/null | head -200'
--prompt='λ -> '
--pointer='❯'
--marker='✓'"
# --bind 'ctrl-e:execute(nvim {} < /dev/tty > /dev/tty 2>&1)' > selected
# --bind 'ctrl-v:execute(code {+})'"
export FZF_DEFAULT_COMMAND='rg --files --no-ignore --hidden --follow -g "!{.git,node_modules}/*" 2> /dev/null'
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"

#########################################################################
# PATH
#########################################################################
if ! [[ "$PATH" =~ "$HOME/.local/bin:$HOME/bin:" ]]; then
    PATH="$HOME/.local/bin:$HOME/bin:$PATH"
fi
export PATH

#########################################################################
# CARGO
#########################################################################
. "$HOME/.cargo/env"

#########################################################################
# P10K SETTINGS
#########################################################################
[[ ! -f ~/.p10k.zsh ]] || source ~/.p10k.zsh

