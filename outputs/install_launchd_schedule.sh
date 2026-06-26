#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL="${TOCK_LAUNCHD_LABEL:-com.codex.fuhuihua-tock}"
RUN_DIR="$HOME/Library/Application Support/$LABEL"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
UID_NUM="$(id -u)"
NODE_BIN="$(command -v node || true)"
NPM_BIN="$(command -v npm || true)"
NPX_BIN="$(command -v npx || true)"
RUN_SCRIPT="${TOCK_RUN_SCRIPT:-run_fuhuihua_at_release.sh}"
LOG_PREFIX="${TOCK_LOG_PREFIX:-tock_reservation}"
TOCK_PAGE_URL="${TOCK_PAGE_URL:-https://www.exploretock.com/fui-hui-hua-san-francisco/experience/559289/winters-depth-spring-approaches-experience}"
TOCK_RELEASE_AT="${TOCK_RELEASE_AT:-2026-06-26T20:00:00-07:00}"
TOCK_DATE="${TOCK_DATE:-2026-07-08}"
TOCK_DATES="${TOCK_DATES:-$TOCK_DATE}"
TOCK_PARTY_SIZES="${TOCK_PARTY_SIZES:-4}"
TOCK_SCAN_DAYS="${TOCK_SCAN_DAYS:-0}"
TOCK_CLOSED_WEEKDAYS="${TOCK_CLOSED_WEEKDAYS:-1,2}"
TOCK_OPPORTUNISTIC_FIRST="${TOCK_OPPORTUNISTIC_FIRST:-0}"
TOCK_LEAD_MS="${TOCK_LEAD_MS:-300000}"
TOCK_BURST_POLL_MS="${TOCK_BURST_POLL_MS:-300}"
TOCK_BURST_FOR_MS="${TOCK_BURST_FOR_MS:-60000}"
TOCK_POLL_MS="${TOCK_POLL_MS:-750}"
TOCK_RELOAD_SETTLE_MS="${TOCK_RELOAD_SETTLE_MS:-500}"
TOCK_OPEN_SETTLE_MS="${TOCK_OPEN_SETTLE_MS:-250}"
TOCK_ACTION_SETTLE_MS="${TOCK_ACTION_SETTLE_MS:-250}"
TOCK_DATE_SETTLE_MS="${TOCK_DATE_SETTLE_MS:-100}"
TOCK_RENDER_WAIT_MS="${TOCK_RENDER_WAIT_MS:-2500}"
TOCK_CHECKOUT_WATCH_MS="${TOCK_CHECKOUT_WATCH_MS:-7000}"
TOCK_CLICK_TIMEOUT_MS="${TOCK_CLICK_TIMEOUT_MS:-4000}"
TOCK_CLICK_RETRIES="${TOCK_CLICK_RETRIES:-2}"
TOCK_RECOVERY_WAIT_MS="${TOCK_RECOVERY_WAIT_MS:-2500}"
TOCK_JITTER_MS="${TOCK_JITTER_MS:-0}"
TOCK_STOP_AFTER_MS="${TOCK_STOP_AFTER_MS:-1800000}"
TOCK_HOLD_AFTER_SUCCESS_MS="${TOCK_HOLD_AFTER_SUCCESS_MS:-14400000}"
TOCK_LAUNCH_MONTH="${TOCK_LAUNCH_MONTH:-6}"
TOCK_LAUNCH_DAY="${TOCK_LAUNCH_DAY:-26}"
TOCK_LAUNCH_HOUR="${TOCK_LAUNCH_HOUR:-16}"
TOCK_LAUNCH_MINUTE="${TOCK_LAUNCH_MINUTE:-55}"

xml_escape() {
  printf '%s' "$1" | sed \
    -e 's/&/\&amp;/g' \
    -e 's/</\&lt;/g' \
    -e 's/>/\&gt;/g' \
    -e 's/"/\&quot;/g' \
    -e "s/'/\&apos;/g"
}

if [[ -z "$NODE_BIN" || -z "$NPM_BIN" || -z "$NPX_BIN" ]]; then
  echo "Could not find node, npm, and npx on PATH."
  echo "Install Node.js/npm first, then rerun this installer."
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/$RUN_SCRIPT" ]]; then
  echo "Run script not found: $SCRIPT_DIR/$RUN_SCRIPT"
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$RUN_DIR"

rsync -a \
  --exclude 'node_modules' \
  --exclude 'tock-profile' \
  --exclude 'session-import-backups' \
  --exclude 'artifacts' \
  --exclude '*.log' \
  "$SCRIPT_DIR/" "$RUN_DIR/"

chmod +x "$RUN_DIR"/*.sh

(
  cd "$RUN_DIR"
  "$NPM_BIN" ci
  "$NPX_BIN" playwright install chromium
)

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>LimitLoadToSessionType</key>
  <string>Aqua</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(xml_escape "$RUN_DIR/$RUN_SCRIPT")</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$(xml_escape "$RUN_DIR")</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Month</key>
    <integer>$TOCK_LAUNCH_MONTH</integer>
    <key>Day</key>
    <integer>$TOCK_LAUNCH_DAY</integer>
    <key>Hour</key>
    <integer>$TOCK_LAUNCH_HOUR</integer>
    <key>Minute</key>
    <integer>$TOCK_LAUNCH_MINUTE</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>$(xml_escape "$RUN_DIR/${LOG_PREFIX}_launchd.out.log")</string>
  <key>StandardErrorPath</key>
  <string>$(xml_escape "$RUN_DIR/${LOG_PREFIX}_launchd.err.log")</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$(xml_escape "$(dirname "$NODE_BIN"):$(dirname "$NPM_BIN"):$(dirname "$NPX_BIN"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin")</string>
    <key>NODE_BIN</key>
    <string>$(xml_escape "$NODE_BIN")</string>
    <key>NPM_BIN</key>
    <string>$(xml_escape "$NPM_BIN")</string>
    <key>NPX_BIN</key>
    <string>$(xml_escape "$NPX_BIN")</string>
    <key>TOCK_HELPER_SCRIPT</key>
    <string>./fuhuihua_tock_reservation.js</string>
    <key>TOCK_LOG_PREFIX</key>
    <string>$(xml_escape "$LOG_PREFIX")</string>
    <key>TOCK_PAGE_URL</key>
    <string>$(xml_escape "$TOCK_PAGE_URL")</string>
    <key>TOCK_RELEASE_AT</key>
    <string>$(xml_escape "$TOCK_RELEASE_AT")</string>
    <key>TOCK_DATE</key>
    <string>$(xml_escape "$TOCK_DATE")</string>
    <key>TOCK_DATES</key>
    <string>$(xml_escape "$TOCK_DATES")</string>
    <key>TOCK_PARTY_SIZES</key>
    <string>$(xml_escape "$TOCK_PARTY_SIZES")</string>
    <key>TOCK_SCAN_DAYS</key>
    <string>$(xml_escape "$TOCK_SCAN_DAYS")</string>
    <key>TOCK_CLOSED_WEEKDAYS</key>
    <string>$(xml_escape "$TOCK_CLOSED_WEEKDAYS")</string>
    <key>TOCK_OPPORTUNISTIC_FIRST</key>
    <string>$(xml_escape "$TOCK_OPPORTUNISTIC_FIRST")</string>
    <key>TOCK_LEAD_MS</key>
    <string>$(xml_escape "$TOCK_LEAD_MS")</string>
    <key>TOCK_BURST_POLL_MS</key>
    <string>$(xml_escape "$TOCK_BURST_POLL_MS")</string>
    <key>TOCK_BURST_FOR_MS</key>
    <string>$(xml_escape "$TOCK_BURST_FOR_MS")</string>
    <key>TOCK_POLL_MS</key>
    <string>$(xml_escape "$TOCK_POLL_MS")</string>
    <key>TOCK_RELOAD_SETTLE_MS</key>
    <string>$(xml_escape "$TOCK_RELOAD_SETTLE_MS")</string>
    <key>TOCK_OPEN_SETTLE_MS</key>
    <string>$(xml_escape "$TOCK_OPEN_SETTLE_MS")</string>
    <key>TOCK_ACTION_SETTLE_MS</key>
    <string>$(xml_escape "$TOCK_ACTION_SETTLE_MS")</string>
    <key>TOCK_DATE_SETTLE_MS</key>
    <string>$(xml_escape "$TOCK_DATE_SETTLE_MS")</string>
    <key>TOCK_RENDER_WAIT_MS</key>
    <string>$(xml_escape "$TOCK_RENDER_WAIT_MS")</string>
    <key>TOCK_CHECKOUT_WATCH_MS</key>
    <string>$(xml_escape "$TOCK_CHECKOUT_WATCH_MS")</string>
    <key>TOCK_CLICK_TIMEOUT_MS</key>
    <string>$(xml_escape "$TOCK_CLICK_TIMEOUT_MS")</string>
    <key>TOCK_CLICK_RETRIES</key>
    <string>$(xml_escape "$TOCK_CLICK_RETRIES")</string>
    <key>TOCK_RECOVERY_WAIT_MS</key>
    <string>$(xml_escape "$TOCK_RECOVERY_WAIT_MS")</string>
    <key>TOCK_JITTER_MS</key>
    <string>$(xml_escape "$TOCK_JITTER_MS")</string>
    <key>TOCK_STOP_AFTER_MS</key>
    <string>$(xml_escape "$TOCK_STOP_AFTER_MS")</string>
    <key>TOCK_HOLD_AFTER_SUCCESS_MS</key>
    <string>$(xml_escape "$TOCK_HOLD_AFTER_SUCCESS_MS")</string>
  </dict>
</dict>
</plist>
PLIST

chmod 600 "$PLIST"
launchctl bootout "gui/$UID_NUM" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$UID_NUM" "$PLIST"
launchctl enable "gui/$UID_NUM/$LABEL"

echo "Installed $LABEL"
echo "It will start on $TOCK_LAUNCH_MONTH/$TOCK_LAUNCH_DAY at $TOCK_LAUNCH_HOUR:$TOCK_LAUNCH_MINUTE local time, then wait for $TOCK_RELEASE_AT."
echo "Runtime copy:"
echo "  $RUN_DIR"
echo "Runtime profile is preserved across reinstalls:"
echo "  $RUN_DIR/tock-profile"
echo "Logs:"
echo "  $RUN_DIR/${LOG_PREFIX}_launchd.out.log"
echo "  $RUN_DIR/${LOG_PREFIX}_launchd.err.log"
