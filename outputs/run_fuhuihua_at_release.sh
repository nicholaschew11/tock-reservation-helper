#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

NODE_BIN="${NODE_BIN:-node}"
if [[ "$NODE_BIN" != */* ]]; then
  NODE_BIN="$(command -v "$NODE_BIN" || true)"
fi

if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "Node executable not found or not executable."
  echo "Run ./install_launchd_schedule.sh again after installing Node.js."
  exit 1
fi

if [[ ! -d node_modules/playwright ]]; then
  echo "Missing node_modules/playwright. Run ./install_launchd_schedule.sh before release time."
  exit 1
fi

HELPER_SCRIPT="${TOCK_HELPER_SCRIPT:-./fuhuihua_tock_reservation.js}"
LOG_PREFIX="${TOCK_LOG_PREFIX:-tock_reservation}"
TOCK_RELEASE_AT="${TOCK_RELEASE_AT:-2026-06-26T20:00:00-07:00}"
TOCK_DATE="${TOCK_DATE:-2026-07-08}"
TOCK_DATES="${TOCK_DATES:-2026-07-08,2026-07-09,2026-07-10}"
TOCK_PARTY_SIZES="${TOCK_PARTY_SIZES:-4}"
TOCK_SCAN_DAYS="${TOCK_SCAN_DAYS:-0}"
TOCK_CLOSED_WEEKDAYS="${TOCK_CLOSED_WEEKDAYS:-1,2}"
TOCK_SHUTDOWN_DATES="${TOCK_SHUTDOWN_DATES:-2026-06-29,2026-06-30,2026-07-01,2026-07-02,2026-07-03,2026-07-04,2026-07-05}"
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

if [[ ! -f "$HELPER_SCRIPT" ]]; then
  echo "Reservation helper script not found: $HELPER_SCRIPT"
  exit 1
fi

OPPORTUNISTIC_ARGS=()
if [[ "${TOCK_OPPORTUNISTIC_FIRST:-0}" == "0" ]]; then
  OPPORTUNISTIC_ARGS+=(--no-opportunistic-first)
fi

CAFFEINATE_ARGS=()
if [[ -x /usr/bin/caffeinate ]]; then
  CAFFEINATE_ARGS+=(/usr/bin/caffeinate -dimsu)
fi

LOG_FILE="$SCRIPT_DIR/${LOG_PREFIX}_run_$(date +%Y%m%d_%H%M%S).log"
echo "Writing run log to $LOG_FILE"

"${CAFFEINATE_ARGS[@]}" "$NODE_BIN" "$HELPER_SCRIPT" \
  --release-at "$TOCK_RELEASE_AT" \
  --date "$TOCK_DATE" \
  --dates "$TOCK_DATES" \
  --party-sizes "$TOCK_PARTY_SIZES" \
  --scan-days "$TOCK_SCAN_DAYS" \
  --closed-weekdays "$TOCK_CLOSED_WEEKDAYS" \
  --shutdown-dates "$TOCK_SHUTDOWN_DATES" \
  "${OPPORTUNISTIC_ARGS[@]}" \
  --fast-network \
  --lead-ms "$TOCK_LEAD_MS" \
  --burst-poll-ms "$TOCK_BURST_POLL_MS" \
  --burst-for-ms "$TOCK_BURST_FOR_MS" \
  --poll-ms "$TOCK_POLL_MS" \
  --reload-settle-ms "$TOCK_RELOAD_SETTLE_MS" \
  --open-settle-ms "$TOCK_OPEN_SETTLE_MS" \
  --action-settle-ms "$TOCK_ACTION_SETTLE_MS" \
  --date-settle-ms "$TOCK_DATE_SETTLE_MS" \
  --render-wait-ms "$TOCK_RENDER_WAIT_MS" \
  --checkout-watch-ms "$TOCK_CHECKOUT_WATCH_MS" \
  --click-timeout-ms "$TOCK_CLICK_TIMEOUT_MS" \
  --click-retries "$TOCK_CLICK_RETRIES" \
  --recovery-wait-ms "$TOCK_RECOVERY_WAIT_MS" \
  --jitter-ms "$TOCK_JITTER_MS" \
  --stop-after-ms "$TOCK_STOP_AFTER_MS" \
  --hold-after-success-ms "$TOCK_HOLD_AFTER_SUCCESS_MS" \
  --artifact-dir "$SCRIPT_DIR/artifacts" \
  "$@" 2>&1 | tee -a "$LOG_FILE"

exit ${pipestatus[1]}
