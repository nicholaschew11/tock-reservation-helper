# Tock Reservation Helper

User-in-the-loop Playwright helper for a Tock reservation release. The helper can
open the target Tock page, keep a persistent browser profile, poll around the
release window, click into checkout when a matching reservation appears, and then
stop for manual completion.

It does not bypass verification, solve captcha, or submit payment.

## Quick Start

For manual/local runs:

```sh
cd outputs
npm ci
npx playwright install chromium
npm run login
npm run preflight
```

For the scheduled launchd run on macOS:

```sh
cd outputs
./install_launchd_schedule.sh
cd "$HOME/Library/Application Support/${TOCK_LAUNCHD_LABEL:-com.codex.fuhuihua-tock}"
npm run login
npm run preflight
```

The scheduled runtime uses its own preserved `tock-profile` under the launchd
runtime folder. Logging in only in the workspace profile is not enough for
launchd.

The checked-in defaults target Fu Hui Hua, party size 4 on July 8, 2026 for
the June 26, 2026 8:00 PM PDT release. A different user can point the same
helper at another Tock page with environment variables or CLI flags:

```sh
TOCK_PAGE_URL="https://www.exploretock.com/example/experience/123/example" \
TOCK_RELEASE_AT="2026-07-01T20:00:00-07:00" \
TOCK_DATE="2026-07-08" \
TOCK_PARTY_SIZES="2" \
npm run preflight
```

For scheduled macOS runs, set those same variables when running
`./install_launchd_schedule.sh`. The installer writes them into the LaunchAgent.

## What Not To Commit

The browser profile, imported cookies, logs, screenshots, local preflight JSON,
and postmortem notes are intentionally ignored by git. Before publishing, run:

```sh
git status --short --ignored
```

Only source files, package metadata, and documentation should be tracked.

## More Details

See [outputs/README.md](outputs/README.md) for setup, scheduling, preflight, and
runtime details.
