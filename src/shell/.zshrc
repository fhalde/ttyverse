export ZDOTDIR=$TTYVERSE_USER_ZDOTDIR
unset TTYVERSE_ZDOTDIR TTYVERSE_USER_ZDOTDIR TTYVERSE_SHELL_DIR
[[ -r $ZDOTDIR/.zshrc ]] && source "$ZDOTDIR/.zshrc"

autoload -Uz add-zsh-hook
_ttyverse_preexec() { typeset -g _ttyverse_command_running=1 }
_ttyverse_precmd() {
  local command_status=$?
  if (( ${_ttyverse_command_running:-0} )); then
    printf '\033]777;ttyverse;complete;%d\007' "$command_status"
    _ttyverse_command_running=0
  fi
  return $command_status
}
add-zsh-hook preexec _ttyverse_preexec
add-zsh-hook precmd _ttyverse_precmd
