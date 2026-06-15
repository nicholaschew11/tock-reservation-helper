#!/bin/zsh
set -euo pipefail

LABEL="${TOCK_LAUNCHD_LABEL:-com.codex.fuhuihua-tock}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
RUN_DIR="$HOME/Library/Application Support/$LABEL"
UID_NUM="$(id -u)"

launchctl bootout "gui/$UID_NUM" "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
rm -rf "$RUN_DIR"
echo "Removed $LABEL"
