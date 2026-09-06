# Load the user's startup files while reserving our .zshrc for integration.
if [[ -n $TTYVERSE_ZDOTDIR ]]; then
  ZDOTDIR=$TTYVERSE_ZDOTDIR
else
  unset ZDOTDIR
fi
[[ -r ${ZDOTDIR:-$HOME}/.zshenv ]] && source "${ZDOTDIR:-$HOME}/.zshenv"
TTYVERSE_USER_ZDOTDIR=${ZDOTDIR:-$HOME}
export ZDOTDIR=$TTYVERSE_SHELL_DIR
