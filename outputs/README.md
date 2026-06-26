# Tock Reservation Helper

This is a user-in-the-loop Playwright helper for a Tock reservation release. It
keeps the browser open for you to finish login, captcha, or payment yourself.

It does not bypass Tock controls and it does not submit payment.

The checked-in defaults target Fu Hui Hua on Friday, June 26, 2026 at 8:00 PM
PDT, trying party size 4 for July 8 first, then July 9 and July 10 as backups.
If the only selectable dates are the prior release week, June 29 through July 5,
the helper stops instead of booking the wrong week. Use environment variables or
CLI flags to target a different restaurant, release time, date, or party size.

## One-time setup

```sh
cd outputs
npm ci
npx playwright install chromium
npm run login
```

In the browser that opens, log in to Tock. Press Enter in the terminal when done.
The helper prefers your installed Google Chrome app for this because Google
sign-in can reject Playwright's bundled "Chrome for Testing" browser.

If Google or Tock rejects social login in that automated browser, use normal
Chrome for the one-time login instead, then import that Tock session into the
helper profile:

```sh
npm run normal-login
npm run import-session
```

After `npm run normal-login`, sign in to Tock in your normal Chrome. Then close
Chrome completely before running `npm run import-session`; Chrome locks its
cookie files while it is open. After import, `npm run login` should open the
helper profile already signed in.

## Run manually

```sh
cd outputs
./run_fuhuihua_at_release.sh
```

To target another Tock page without editing files:

```sh
TOCK_PAGE_URL="https://www.exploretock.com/example/experience/123/example" \
TOCK_RELEASE_AT="2026-07-01T20:00:00-07:00" \
TOCK_DATE="2026-07-08" \
TOCK_DATES="2026-07-08" \
TOCK_PARTY_SIZES="2" \
./run_fuhuihua_at_release.sh
```

If you start this early, it waits until the release and then refreshes. On
macOS, the wrapper uses `caffeinate` so your Mac does not sleep while it is
running. The scheduled run prewarms the page/session before release, then
refreshes up to roughly three times per second for the first minute after the
release. It uses fast network mode, which blocks images, media, fonts, and
nonessential analytics requests while keeping Tock, Cloudflare/verification,
and Stripe available. The scheduled run also uses shorter UI settle delays, a
longer per-click timeout, immediate debug screenshots/HTML when an action click
fails, and a checkout latch: once any Tock `/checkout/...` URL is seen, the
script stops refreshing and leaves the browser open for manual checkout. The
local simulation verifies that the helper reaches checkout and then stops
instead of refreshing away.

## Schedule on macOS

```sh
cd outputs
./install_launchd_schedule.sh
```

With the checked-in defaults, the LaunchAgent starts early on June 26 at 4:55
PM local time and the script waits for the exact 8:00 PM PDT release timestamp.
Starting early keeps the schedule safe if the laptop is in either Pacific or
Eastern time.

For a different target, pass the same target settings to the installer. It
copies them into the LaunchAgent environment:

```sh
TOCK_PAGE_URL="https://www.exploretock.com/example/experience/123/example" \
TOCK_RELEASE_AT="2026-07-01T20:00:00-07:00" \
TOCK_DATE="2026-07-08" \
TOCK_DATES="2026-07-08" \
TOCK_PARTY_SIZES="2" \
TOCK_LAUNCH_MONTH="7" \
TOCK_LAUNCH_DAY="1" \
TOCK_LAUNCH_HOUR="19" \
TOCK_LAUNCH_MINUTE="55" \
TOCK_LAUNCHD_LABEL="com.example.tock-helper" \
./install_launchd_schedule.sh
```

To remove the schedule:

```sh
./uninstall_launchd_schedule.sh
```

## Useful overrides

```sh
# Run a local fake Tock release and verify the helper reaches checkout.
npm run simulate

# Verify it stops when only the prior release week is selectable.
npm run simulate:shutdown-week

# No-click readiness check using this folder's profile.
npm run preflight

# From the workspace, check the installed launchd runtime profile.
npm run preflight:runtime

# Test immediately for 15 seconds without waiting for release.
node ./fuhuihua_tock_reservation.js --now --stop-after-ms 15000

# Disable resource blocking if Tock changes and the page looks broken.
node ./fuhuihua_tock_reservation.js --no-fast-network

# Prioritize exact dining dates and party sizes if you have preferences.
node ./fuhuihua_tock_reservation.js --dates 2026-07-08 --party-sizes 2

# Add a dining-time hint, if desired. This is not the release time.
node ./fuhuihua_tock_reservation.js --time 18:30

# Force bundled Chromium instead of your installed Google Chrome.
node ./fuhuihua_tock_reservation.js --browser-channel=""
```

## Release-night checks

- Keep the Mac awake and logged in before the launch time. `caffeinate` starts
  only after launchd starts the helper; it does not wake a sleeping Mac by
  itself.
- Run `npm run preflight` from this folder before release day and again earlier
  on release day. It does not click booking buttons; it checks that the current
  folder's profile clears Cloudflare and can see your target party size and
  date.
- The scheduled launchd copy lives under
  `~/Library/Application Support/${TOCK_LAUNCHD_LABEL:-com.codex.fuhuihua-tock}`.
  Run `npm run preflight:runtime` from the workspace, or run `npm run preflight`
  inside that runtime folder, to check the profile launchd will actually use.
