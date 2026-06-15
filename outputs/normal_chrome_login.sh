#!/bin/zsh
set -euo pipefail

DEFAULT_PAGE_URL="https://www.exploretock.com/fui-hui-hua-san-francisco/experience/559289/winters-depth-spring-approaches-experience"
LOGIN_URL="${TOCK_LOGIN_URL:-${TOCK_PAGE_URL:-$DEFAULT_PAGE_URL}}"

echo "Opening Tock login in your normal Chrome profile."
echo "Sign in there first. After Tock shows you are logged in, close Chrome before importing the session."

open -a "Google Chrome" "$LOGIN_URL"
