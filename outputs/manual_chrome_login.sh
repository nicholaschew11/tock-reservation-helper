#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROFILE_DIR="$SCRIPT_DIR/tock-profile"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DEFAULT_PAGE_URL="https://www.exploretock.com/fui-hui-hua-san-francisco/experience/559289/winters-depth-spring-approaches-experience"
LOGIN_URL="${TOCK_LOGIN_URL:-${TOCK_PAGE_URL:-$DEFAULT_PAGE_URL}}"

if [[ ! -x "$CHROME" ]]; then
  echo "Could not find Google Chrome at $CHROME"
  exit 1
fi

mkdir -p "$PROFILE_DIR"

echo "Opening normal Google Chrome with the helper's saved profile:"
echo "  $PROFILE_DIR"
echo
echo "Sign in to Tock, then fully close this Chrome window before Friday's scheduled run."
echo "Leaving it open will lock the profile and prevent the reservation helper from starting."

exec "$CHROME" \
  --user-data-dir="$PROFILE_DIR" \
  "$LOGIN_URL"
