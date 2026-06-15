#!/usr/bin/env node
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PAGE_URL =
  "https://www.exploretock.com/fui-hui-hua-san-francisco/experience/559289/winters-depth-spring-approaches-experience";

const DEFAULTS = {
  pageUrl: PAGE_URL,
  partySize: 4,
  partySizes: null,
  releaseAt: "2026-06-19T20:00:00-07:00",
  date: "2026-06-24",
  searchTime: "",
  profileDir: path.join(__dirname, "tock-profile"),
  leadMs: 5 * 60 * 1000,
  pollMs: 1_500,
  burstPollMs: 650,
  burstForMs: 60 * 1000,
  reloadSettleMs: 900,
  openSettleMs: 650,
  actionSettleMs: 650,
  dateSettleMs: 250,
  renderWaitMs: 2_500,
  checkoutWatchMs: 7_000,
  clickTimeoutMs: 4_000,
  clickRetries: 2,
  retryPauseMs: 125,
  recoveryWaitMs: 2_500,
  jitterMs: 250,
  stopAfterMs: 10 * 60 * 1000,
  holdAfterSuccessMs: 60 * 60 * 1000,
  scanDays: 60,
  closedWeekdays: [],
  opportunisticFirst: true,
  artifactDir: path.join(__dirname, "artifacts"),
  browserChannel: "chrome",
  fastNetwork: true,
  headless: false,
  dryRun: false,
};

function usage() {
  console.log(`
Usage:
  node fuhuihua_tock_reservation.js --login
  node fuhuihua_tock_reservation.js
  node fuhuihua_tock_reservation.js --now --stop-after-ms 15000

Defaults:
  release time: 2026-06-19 8:00 PM PDT
  party size:   4
  start date:   2026-06-24

Options:
  --login                  Open a persistent browser profile so you can log in.
  --now                    Start checking immediately instead of waiting.
  --date YYYY-MM-DD        First calendar date to scan.
  --dates A,B,C            Exact dates to prioritize before the scan range.
  --time HH:MM             Optional dining-time hint for Tock's URL.
  --page-url URL           Override the Tock page URL, mainly for testing.
  --release-at ISO         Release timestamp, e.g. 2026-06-12T20:00:00-07:00.
  --party-size N           Party size. Default: 4.
  --party-sizes A,B        Party sizes to try in order, e.g. 4,3.
  --poll-ms N              Delay between refreshes after the burst. Default: 1500.
  --burst-poll-ms N        First-minute refresh delay. Default: 650.
  --burst-for-ms N         How long to use burst polling. Default: 60000.
  --reload-settle-ms N     Max wait for dynamic content after reload. Default: 900.
  --open-settle-ms N       Wait after opening availability. Default: 650.
  --action-settle-ms N     Wait after booking/next clicks. Default: 650.
  --date-settle-ms N       Wait after date selection. Default: 250.
  --render-wait-ms N       Max wait for Tock controls after navigation. Default: 2500.
  --checkout-watch-ms N    No-refresh checkout watch after action clicks. Default: 7000.
  --click-timeout-ms N     Per-click timeout. Default: 4000.
  --click-retries N        Retry failed clicks before giving up. Default: 2.
  --recovery-wait-ms N     Hold page after a failed action click. Default: 2500.
  --jitter-ms N            Max random polling jitter. Default: 250.
  --closed-weekdays A,B    Skip weekdays, Sunday=0 ... Saturday=6.
  --no-opportunistic-first Do not click a visible slot before date scanning.
  --artifact-dir PATH      Save screenshots/HTML for action failures.
  --stop-after-ms N        Stop trying after this long. Default: 600000.
  --profile-dir PATH       Persistent browser profile. Default: ./tock-profile.
  --browser-channel NAME   Playwright browser channel. Default: chrome.
                           Use "" to force bundled Chromium.
  --no-fast-network        Do not block images/fonts/media/analytics.
  --dry-run                Do everything except click booking/action buttons.
  --headless               Run Chromium without a visible browser.
`);
}

function takeValue(argv, index, current) {
  const eq = current.indexOf("=");
  if (eq !== -1) return [current.slice(0, eq), current.slice(eq + 1), index];
  const next = argv[index + 1];
  if (next && !next.startsWith("--")) return [current, next, index + 1];
  return [current, "true", index];
}

function parsePartySizes(value) {
  return value
    .split(",")
    .map((size) => Number(size.trim()))
    .filter((size) => Number.isFinite(size));
}

function parseNumberList(value) {
  return value
    .split(",")
    .map((number) => Number(number.trim()))
    .filter((number) => Number.isFinite(number));
}

function parseArgs(argv) {
  const cfg = {
    ...DEFAULTS,
    pageUrl: process.env.TOCK_PAGE_URL || DEFAULTS.pageUrl,
    releaseAt: process.env.TOCK_RELEASE_AT || DEFAULTS.releaseAt,
    date: process.env.TOCK_DATE || DEFAULTS.date,
    searchTime: process.env.TOCK_TIME || DEFAULTS.searchTime,
    profileDir: process.env.TOCK_PROFILE_DIR || DEFAULTS.profileDir,
    browserChannel: process.env.TOCK_BROWSER_CHANNEL ?? DEFAULTS.browserChannel,
    fastNetwork: process.env.TOCK_FAST_NETWORK === "0" ? false : DEFAULTS.fastNetwork,
    partySizes: process.env.TOCK_PARTY_SIZES ? parsePartySizes(process.env.TOCK_PARTY_SIZES) : DEFAULTS.partySizes,
    pollMs: Number(process.env.TOCK_POLL_MS || DEFAULTS.pollMs),
    burstPollMs: Number(process.env.TOCK_BURST_POLL_MS || DEFAULTS.burstPollMs),
    burstForMs: Number(process.env.TOCK_BURST_FOR_MS || DEFAULTS.burstForMs),
    reloadSettleMs: Number(process.env.TOCK_RELOAD_SETTLE_MS || DEFAULTS.reloadSettleMs),
    openSettleMs: Number(process.env.TOCK_OPEN_SETTLE_MS || DEFAULTS.openSettleMs),
    actionSettleMs: Number(process.env.TOCK_ACTION_SETTLE_MS || DEFAULTS.actionSettleMs),
    dateSettleMs: Number(process.env.TOCK_DATE_SETTLE_MS || DEFAULTS.dateSettleMs),
    renderWaitMs: Number(process.env.TOCK_RENDER_WAIT_MS || DEFAULTS.renderWaitMs),
    checkoutWatchMs: Number(process.env.TOCK_CHECKOUT_WATCH_MS || DEFAULTS.checkoutWatchMs),
    clickTimeoutMs: Number(process.env.TOCK_CLICK_TIMEOUT_MS || DEFAULTS.clickTimeoutMs),
    clickRetries: Number(process.env.TOCK_CLICK_RETRIES || DEFAULTS.clickRetries),
    retryPauseMs: Number(process.env.TOCK_RETRY_PAUSE_MS || DEFAULTS.retryPauseMs),
    recoveryWaitMs: Number(process.env.TOCK_RECOVERY_WAIT_MS || DEFAULTS.recoveryWaitMs),
    jitterMs: Number(process.env.TOCK_JITTER_MS || DEFAULTS.jitterMs),
    stopAfterMs: Number(process.env.TOCK_STOP_AFTER_MS || DEFAULTS.stopAfterMs),
    closedWeekdays: process.env.TOCK_CLOSED_WEEKDAYS
      ? parseNumberList(process.env.TOCK_CLOSED_WEEKDAYS)
      : DEFAULTS.closedWeekdays,
    opportunisticFirst: process.env.TOCK_OPPORTUNISTIC_FIRST === "0" ? false : DEFAULTS.opportunisticFirst,
    artifactDir: process.env.TOCK_ARTIFACT_DIR || DEFAULTS.artifactDir,
    dates: [],
    login: false,
    now: false,
  };

  if (process.env.TOCK_DATES) {
    cfg.dates = process.env.TOCK_DATES.split(",").map((s) => s.trim()).filter(Boolean);
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (!arg.startsWith("--")) continue;
    const [key, value, newIndex] = takeValue(argv, i, arg.slice(2));
    i = newIndex;

    switch (key) {
      case "login":
        cfg.login = true;
        break;
      case "now":
        cfg.now = true;
        break;
      case "dry-run":
        cfg.dryRun = true;
        break;
      case "fast-network":
        cfg.fastNetwork = true;
        break;
      case "no-fast-network":
        cfg.fastNetwork = false;
        break;
      case "headless":
        cfg.headless = true;
        break;
      case "date":
        cfg.date = value;
        break;
      case "dates":
        cfg.dates = value.split(",").map((s) => s.trim()).filter(Boolean);
        break;
      case "time":
        cfg.searchTime = value;
        break;
      case "page-url":
        cfg.pageUrl = value;
        break;
      case "release-at":
        cfg.releaseAt = value;
        break;
      case "party-size":
        cfg.partySize = Number(value);
        break;
      case "party-sizes":
        cfg.partySizes = parsePartySizes(value);
        break;
      case "poll-ms":
        cfg.pollMs = Number(value);
        break;
      case "burst-poll-ms":
        cfg.burstPollMs = Number(value);
        break;
      case "burst-for-ms":
        cfg.burstForMs = Number(value);
        break;
      case "reload-settle-ms":
        cfg.reloadSettleMs = Number(value);
        break;
      case "open-settle-ms":
        cfg.openSettleMs = Number(value);
        break;
      case "action-settle-ms":
        cfg.actionSettleMs = Number(value);
        break;
      case "date-settle-ms":
        cfg.dateSettleMs = Number(value);
        break;
      case "render-wait-ms":
        cfg.renderWaitMs = Number(value);
        break;
      case "checkout-watch-ms":
        cfg.checkoutWatchMs = Number(value);
        break;
      case "click-timeout-ms":
        cfg.clickTimeoutMs = Number(value);
        break;
      case "click-retries":
        cfg.clickRetries = Number(value);
        break;
      case "retry-pause-ms":
        cfg.retryPauseMs = Number(value);
        break;
      case "recovery-wait-ms":
        cfg.recoveryWaitMs = Number(value);
        break;
      case "jitter-ms":
        cfg.jitterMs = Number(value);
        break;
      case "closed-weekdays":
        cfg.closedWeekdays = parseNumberList(value);
        break;
      case "no-opportunistic-first":
        cfg.opportunisticFirst = false;
        break;
      case "artifact-dir":
        cfg.artifactDir = path.resolve(value);
        break;
      case "lead-ms":
        cfg.leadMs = Number(value);
        break;
      case "stop-after-ms":
        cfg.stopAfterMs = Number(value);
        break;
      case "hold-after-success-ms":
        cfg.holdAfterSuccessMs = Number(value);
        break;
      case "profile-dir":
        cfg.profileDir = path.resolve(value);
        break;
      case "browser-channel":
        cfg.browserChannel = value;
        break;
      case "scan-days":
        cfg.scanDays = Number(value);
        break;
      default:
        throw new Error(`Unknown option: --${key}`);
    }
  }

  if (!Number.isFinite(cfg.partySize) || cfg.partySize < 1) {
    throw new Error("--party-size must be a positive number");
  }
  if (cfg.partySizes && cfg.partySizes.some((size) => !Number.isInteger(size) || size < 1)) {
    throw new Error("--party-sizes must contain positive whole numbers");
  }
  if (cfg.partySizes && cfg.partySizes.length > 0) {
    cfg.partySize = cfg.partySizes[0];
  } else {
    cfg.partySizes = [cfg.partySize];
  }
  if (!Number.isFinite(cfg.pollMs) || cfg.pollMs < 250) {
    throw new Error("--poll-ms must be at least 250");
  }
  if (!Number.isFinite(cfg.burstPollMs) || cfg.burstPollMs < 250) {
    throw new Error("--burst-poll-ms must be at least 250");
  }
  if (!Number.isFinite(cfg.burstForMs) || cfg.burstForMs < 0) {
    throw new Error("--burst-for-ms must be a non-negative number");
  }
  if (!Number.isFinite(cfg.reloadSettleMs) || cfg.reloadSettleMs < 250) {
    throw new Error("--reload-settle-ms must be at least 250");
  }
  if (!Number.isFinite(cfg.openSettleMs) || cfg.openSettleMs < 0) {
    throw new Error("--open-settle-ms must be a non-negative number");
  }
  if (!Number.isFinite(cfg.actionSettleMs) || cfg.actionSettleMs < 0) {
    throw new Error("--action-settle-ms must be a non-negative number");
  }
  if (!Number.isFinite(cfg.dateSettleMs) || cfg.dateSettleMs < 0) {
    throw new Error("--date-settle-ms must be a non-negative number");
  }
  if (!Number.isFinite(cfg.renderWaitMs) || cfg.renderWaitMs < 0) {
    throw new Error("--render-wait-ms must be a non-negative number");
  }
  if (!Number.isFinite(cfg.checkoutWatchMs) || cfg.checkoutWatchMs < 0) {
    throw new Error("--checkout-watch-ms must be a non-negative number");
  }
  if (!Number.isFinite(cfg.clickTimeoutMs) || cfg.clickTimeoutMs < 500) {
    throw new Error("--click-timeout-ms must be at least 500");
  }
  if (!Number.isInteger(cfg.clickRetries) || cfg.clickRetries < 1) {
    throw new Error("--click-retries must be a positive whole number");
  }
  if (!Number.isFinite(cfg.retryPauseMs) || cfg.retryPauseMs < 0) {
    throw new Error("--retry-pause-ms must be a non-negative number");
  }
  if (!Number.isFinite(cfg.recoveryWaitMs) || cfg.recoveryWaitMs < 0) {
    throw new Error("--recovery-wait-ms must be a non-negative number");
  }
  if (!Number.isFinite(cfg.jitterMs) || cfg.jitterMs < 0) {
    throw new Error("--jitter-ms must be a non-negative number");
  }
  if (cfg.closedWeekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new Error("--closed-weekdays values must be whole numbers from 0 to 6");
  }
  if (Number.isNaN(new Date(cfg.releaseAt).getTime())) {
    throw new Error(`Could not parse --release-at: ${cfg.releaseAt}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cfg.date)) {
    throw new Error("--date must be YYYY-MM-DD");
  }
  if (cfg.dates.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) {
    throw new Error("--dates values must be YYYY-MM-DD");
  }

  cfg.artifactDir = path.resolve(cfg.artifactDir);
  cfg.runId = new Date().toISOString().replace(/[:.]/g, "-");
  cfg.lastClickFailure = null;
  cfg.checkoutSeen = false;
  cfg.checkoutSeenUrl = "";

  return cfg;
}

function formatPT(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function log(message) {
  console.log(`[${formatPT()}] ${message}`);
}

function duration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

async function waitUntil(timestamp, label) {
  while (Date.now() < timestamp) {
    const remaining = timestamp - Date.now();
    log(`${label} in ${duration(remaining)}`);
    await sleep(Math.min(remaining, 60_000));
  }
}

function buildSearchUrl(cfg, cacheBust = false) {
  const url = new URL(cfg.pageUrl);
  url.searchParams.set("date", cfg.date);
  url.searchParams.set("size", String(cfg.partySize));
  if (cfg.searchTime) url.searchParams.set("time", cfg.searchTime);
  if (cacheBust) url.searchParams.set("_", String(Date.now()));
  return url.toString();
}

async function launchBrowser(cfg) {
  fs.mkdirSync(cfg.profileDir, { recursive: true });
  const launchOptions = {
    headless: cfg.headless,
    chromiumSandbox: true,
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    viewport: { width: 1440, height: 1000 },
  };

  if (cfg.browserChannel) {
    launchOptions.channel = cfg.browserChannel;
  }

  let context;
  try {
    context = await chromium.launchPersistentContext(cfg.profileDir, launchOptions);
  } catch (error) {
    if (!cfg.browserChannel) throw error;
    log(`Could not launch browser channel "${cfg.browserChannel}": ${error.message.split("\n")[0]}`);
    log("Falling back to bundled Chromium.");
    const { channel: _channel, ...fallbackOptions } = launchOptions;
    context = await chromium.launchPersistentContext(cfg.profileDir, fallbackOptions);
  }

  const page = context.pages()[0] || (await context.newPage());
  page.setDefaultTimeout(2_000);
  return { context, page };
}

async function installFastNetworkRoutes(context) {
  const blockedResourceTypes = new Set(["image", "media", "font"]);
  const blockedHosts = [
    "analytics.google.com",
    "api2.amplitude.com",
    "bat.bing.com",
    "browser-intake-us5-datadoghq.com",
    "clarity.ms",
    "connect.facebook.net",
    "consent.trustarc.com",
    "doubleclick.net",
    "facebook.com",
    "google-analytics.com",
    "googleadservices.com",
    "googletagmanager.com",
    "z.clarity.ms",
  ];

  await context.route("**/*", async (route) => {
    const request = route.request();
    const resourceType = request.resourceType();
    let hostname = "";
    try {
      hostname = new URL(request.url()).hostname;
    } catch {
      hostname = "";
    }

    const blocked =
      blockedResourceTypes.has(resourceType) ||
      blockedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));

    if (blocked) {
      await route.abort("blockedbyclient").catch(() => {});
      return;
    }

    await route.continue().catch(() => {});
  });
}

async function runLogin(cfg) {
  log(`Opening Tock in persistent profile: ${cfg.profileDir}`);
  const { context, page } = await launchBrowser(cfg);
  await page.goto(cfg.pageUrl, { waitUntil: "domcontentloaded" });
  log("Log in to Tock in the browser window. Your session will remain in this profile.");

  if (process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await rl.question("Press Enter here after you are logged in...");
    rl.close();
    await context.close();
  } else {
    log("No interactive terminal detected; keeping the browser open for 15 minutes.");
    await sleep(15 * 60 * 1000);
    await context.close();
  }
}

function notify(title, message) {
  process.stdout.write("\u0007");
  log(`${title}: ${message}`);
  if (process.platform !== "darwin") return;
  const script = `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`;
  const child = spawn("osascript", ["-e", script], { detached: true, stdio: "ignore" });
  child.unref();
}

async function pageText(page) {
  return page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
}

function checkoutUrlLike(url) {
  return /\/checkout(?:[/?#]|$)/i.test(url || "");
}

async function noteCheckoutIfPresent(page, cfg, source) {
  const url = page.url();
  if (checkoutUrlLike(url)) {
    if (!cfg.checkoutSeen) {
      cfg.checkoutSeen = true;
      cfg.checkoutSeenUrl = url;
      log(`Checkout detected from ${source}: ${url}`);
      await saveArtifact(page, cfg, "checkout-detected").catch(() => {});
    }
    return true;
  }
  return cfg.checkoutSeen;
}

async function checkoutReached(page, cfg, source) {
  if (await noteCheckoutIfPresent(page, cfg, source)) return true;
  const text = await pageText(page);
  if (checkoutLike(text, page.url())) {
    cfg.checkoutSeen = true;
    cfg.checkoutSeenUrl = page.url();
    log(`Checkout-like page detected from ${source}: ${page.url()}`);
    await saveArtifact(page, cfg, "checkout-like-detected").catch(() => {});
    return true;
  }
  return false;
}

async function isVisibleEnabled(locator) {
  try {
    return (await locator.isVisible()) && (await locator.isEnabled());
  } catch {
    return false;
  }
}

function sanitizeFilePart(value) {
  return String(value).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "artifact";
}

async function saveArtifact(page, cfg, reason) {
  if (!page || !cfg.artifactDir) return;
  fs.mkdirSync(cfg.artifactDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.join(cfg.artifactDir, `${cfg.runId}-${stamp}-${sanitizeFilePart(reason)}`);
  await page.screenshot({ path: `${base}.png`, fullPage: true, timeout: 2_000 }).catch(() => {});
  const html = await page.content().catch(() => "");
  if (html) fs.writeFileSync(`${base}.html`, html);
  log(`Saved debug artifact: ${base}.png`);
}

async function safeClick(page, locator, cfg, label) {
  if (await noteCheckoutIfPresent(page, cfg, `before click ${label}`)) return true;
  if (!(await isVisibleEnabled(locator))) return false;
  if (cfg.dryRun) {
    log(`[dry-run] Would click: ${label}`);
    return true;
  }
  cfg.lastClickFailure = null;
  for (let attempt = 1; attempt <= cfg.clickRetries; attempt += 1) {
    await locator.scrollIntoViewIfNeeded({ timeout: 1_000 }).catch(() => {});
    try {
      await locator.click({ timeout: cfg.clickTimeoutMs });
      if (await noteCheckoutIfPresent(page, cfg, `after click ${label}`)) return true;
      return true;
    } catch (error) {
      if (await noteCheckoutIfPresent(page, cfg, `click failure ${label}`)) return true;
      const message = error.message.split("\n")[0];
      cfg.lastClickFailure = { label, message };
      log(`Could not click ${label} (attempt ${attempt}/${cfg.clickRetries}): ${message}`);
      await saveArtifact(page, cfg, `click-failed-${label}-attempt-${attempt}`);
      if (attempt < cfg.clickRetries) await sleep(cfg.retryPauseMs);
    }
  }
  return false;
}

async function buttonLabel(locator, fallback) {
  try {
    return await locator.evaluate((el) => {
      const aria = el.getAttribute("aria-label");
      const text = el.textContent || "";
      return (aria || text).replace(/\s+/g, " ").trim();
    });
  } catch {
    return fallback;
  }
}

async function visibleDialog(page) {
  const dialogs = page.getByRole("dialog");
  const count = await dialogs.count().catch(() => 0);
  for (let i = count - 1; i >= 0; i -= 1) {
    const dialog = dialogs.nth(i);
    if (await dialog.isVisible().catch(() => false)) return dialog;
  }
  return null;
}

async function controlScopes(page) {
  const dialog = await visibleDialog(page);
  return dialog ? [dialog, page] : [page];
}

async function activeControlScope(page) {
  return (await visibleDialog(page)) || page;
}

async function textForScope(page, scope) {
  if (scope === page) return pageText(page);
  return scope.innerText({ timeout: 2_000 }).catch(() => "");
}

function dateDisplayRegex(date) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return new RegExp(date.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const monthName = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "America/Los_Angeles" }).format(
    new Date(Date.UTC(year, month - 1, day, 12)),
  );
  return new RegExp(`${date}|${monthName}\\s+${day},\\s*${year}|${month}/${day}/${year}`, "i");
}

function urlParamMatches(page, key, value) {
  try {
    return new URL(page.url()).searchParams.get(key) === String(value);
  } catch {
    return false;
  }
}

async function waitForTockRender(page, cfg, source) {
  const deadline = Date.now() + cfg.renderWaitMs;
  const readyText =
    /all reservations|new reservations|not opened reservations|sold out|notify|\bbook\b|reserve now|reserve at|^reserve$|([1-9]|1[0-2]):[0-5]\d\s*(AM|PM)/i;
  const selectorSentinels = [
    '[data-testid="booking-card-button"]',
  ];

  while (Date.now() <= deadline) {
    if (await checkoutReached(page, cfg, `${source} render wait`)) return true;
    const scope = await activeControlScope(page);
    for (const selector of selectorSentinels) {
      if (await scope.locator(selector).first().isVisible().catch(() => false)) return true;
    }
    const text = await textForScope(page, scope);
    if (readyText.test(text)) return true;
    await sleep(100);
  }

  log(`Timed out waiting for Tock controls after ${source}; scanning current DOM anyway.`);
  return false;
}

async function waitForCheckoutAfterAction(page, cfg, source) {
  if (await checkoutReached(page, cfg, source)) return true;
  const deadline = Date.now() + cfg.checkoutWatchMs;
  await page
    .waitForURL((url) => checkoutUrlLike(url.toString()), { timeout: Math.min(cfg.checkoutWatchMs, 5_000) })
    .catch(() => {});

  while (Date.now() <= deadline) {
    if (await checkoutReached(page, cfg, `${source} checkout watch`)) return true;
    await sleep(250);
  }
  return false;
}

async function clickFirstControl(page, cfg, roles, regexes, blocked = []) {
  if (await noteCheckoutIfPresent(page, cfg, "before control scan")) return null;
  for (const scope of await controlScopes(page)) {
    for (const role of roles) {
      for (const regex of regexes) {
        const controls = scope.getByRole(role, { name: regex });
        const count = await controls.count().catch(() => 0);
        for (let i = 0; i < count; i += 1) {
          const control = controls.nth(i);
          const label = await buttonLabel(control, regex.toString());
          if (blocked.some((blockedRegex) => blockedRegex.test(label))) continue;
          if (await safeClick(page, control, cfg, label || regex.toString())) {
            return label || regex.toString();
          }
        }
      }
    }
  }
  return null;
}

async function clickFirstButton(page, cfg, regexes, blocked = []) {
  return clickFirstControl(page, cfg, ["button"], regexes, blocked);
}

async function clickFirstButtonOrLink(page, cfg, regexes, blocked = []) {
  return clickFirstControl(page, cfg, ["button", "link"], regexes, blocked);
}

async function clickFirstSelector(page, cfg, selector, labelPrefix, blocked = []) {
  if (await noteCheckoutIfPresent(page, cfg, "before selector scan")) return null;
  for (const scope of await controlScopes(page)) {
    const controls = scope.locator(selector);
    const count = await controls.count().catch(() => 0);
    for (let i = 0; i < count; i += 1) {
      const control = controls.nth(i);
      const label = await buttonLabel(control, `${labelPrefix} ${i + 1}`);
      if (blocked.some((blockedRegex) => blockedRegex.test(label))) continue;
      if (await safeClick(page, control, cfg, label || `${labelPrefix} ${i + 1}`)) {
        return label || `${labelPrefix} ${i + 1}`;
      }
    }
  }
  return null;
}

async function selectFirstMatchingOption(page, optionRegexes) {
  const scope = await activeControlScope(page);
  const select = scope.getByRole("combobox", { name: /reservation time|time/i }).first();
  if (!(await select.isVisible().catch(() => false))) return null;
  for (const regex of optionRegexes) {
    const value = await select.evaluate((el, source) => {
      const pattern = new RegExp(source, "i");
      const options = Array.from(el.options || []);
      const option = options.find((candidate) => pattern.test(candidate.textContent || ""));
      return option ? option.value : null;
    }, regex.source).catch(() => null);
    if (value) {
      await select.selectOption(value).catch(() => null);
      return value;
    }
  }
  return null;
}

async function clickTimeCardByText(page, cfg, regexes) {
  const blockedLabels = [/notify/i, /sold out/i];
  const cards = page.locator("text=/^([1-9]|1[0-2]):[0-5]\\d\\s*(AM|PM)$/i");
  const count = await cards.count().catch(() => 0);
  for (let i = 0; i < count; i += 1) {
    const timeText = (await cards.nth(i).innerText().catch(() => "")).trim();
    if (!regexes.some((regex) => regex.test(timeText))) continue;
    const bookButton = cards
      .nth(i)
      .locator("xpath=ancestor::*[.//button][1]")
      .getByRole("button", { name: /^Book$|^Reserve$/i })
      .first();
    const label = await buttonLabel(bookButton, `Book ${timeText}`);
    if (blockedLabels.some((regex) => regex.test(label))) continue;
    if (await safeClick(page, bookButton, cfg, label || `Book ${timeText}`)) return timeText;
  }
  return null;
}

async function openAvailabilitySurface(page, cfg) {
  if (await visibleDialog(page)) return null;

  const opened = await clickFirstButtonOrLink(
    page,
    cfg,
    [/Search within/i, /Book now/i, /^Book$/i],
    [/use tock/i, /sign up/i, /log in/i, /request information/i, /notify/i, /sold out/i],
  );
  if (opened) {
    log(`Opened availability surface: ${opened}`);
    await page.waitForLoadState("domcontentloaded", { timeout: 2_000 }).catch(() => {});
    await sleep(cfg.openSettleMs);
  }
  return opened;
}

async function ensurePartySize(page, cfg) {
  const targetText = new RegExp(`\\b${cfg.partySize}\\s+guests?\\b`, "i");

  for (let i = 0; i < 8; i += 1) {
    const scope = await activeControlScope(page);
    if (await scope.getByText(targetText).first().isVisible().catch(() => false)) return true;
    if (urlParamMatches(page, "size", cfg.partySize)) return true;

    const text = await textForScope(page, scope);
    if (targetText.test(text)) return true;

    const match = text.match(/\b(\d+)\s+guests?\b/i);
    if (!match) return false;
    const current = Number(match[1]);
    const direction =
      current < cfg.partySize
        ? scope.getByRole("button", { name: /More guests/i })
        : scope.getByRole("button", { name: /Fewer guests/i });

    if (!(await safeClick(page, direction.first(), cfg, current < cfg.partySize ? "More guests" : "Fewer guests"))) {
      return false;
    }
    await sleep(200);
  }
  return false;
}

function addDays(yyyyMmDd, days) {
  const date = new Date(`${yyyyMmDd}T12:00:00-07:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekdayFor(yyyyMmDd) {
  return new Date(`${yyyyMmDd}T12:00:00-07:00`).getDay();
}

function datesToTry(cfg) {
  const prioritized = [...cfg.dates];
  if (!prioritized.includes(cfg.date)) prioritized.unshift(cfg.date);

  const seen = new Set(prioritized);
  const closed = new Set(cfg.closedWeekdays);
  const dates = prioritized.filter((date) => !closed.has(weekdayFor(date)));
  for (let i = 0; i < cfg.scanDays; i += 1) {
    const next = addDays(cfg.date, i);
    if (!seen.has(next) && !closed.has(weekdayFor(next))) {
      dates.push(next);
      seen.add(next);
    }
  }
  return dates;
}

async function selectDateIfAvailable(page, cfg, date) {
  const scope = await activeControlScope(page);
  if (urlParamMatches(page, "date", date)) return true;
  const dateSummary = scope.getByRole("button", { name: dateDisplayRegex(date) }).first();
  if (await dateSummary.isVisible().catch(() => false)) return true;

  const dateButton = scope.getByRole("button", { name: date }).first();
  if (!(await isVisibleEnabled(dateButton))) return false;
  await safeClick(page, dateButton, cfg, date);
  await sleep(cfg.dateSettleMs);
  return true;
}

function timeRegexes(cfg) {
  const regexes = [];
  if (cfg.searchTime) {
    const [hours, minutes] = cfg.searchTime.split(":").map(Number);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      const hour12 = ((hours + 11) % 12) + 1;
      const ampm = hours >= 12 ? "PM" : "AM";
      regexes.push(new RegExp(`^${hour12}:${String(minutes).padStart(2, "0")}\\s*${ampm}$`, "i"));
    }
  }
  regexes.push(/^([1-9]|1[0-2]):[0-5]\d\s*(AM|PM)$/i);
  return regexes;
}

function checkoutLike(text, url) {
  return (
    checkoutUrlLike(url) ||
    /payment|checkout|order summary|reservation held|complete your reservation|sign in to continue|log in to continue/i.test(text)
  );
}

async function clickTowardCheckout(page, cfg) {
  const blockedLabels = [
    /notify/i,
    /sold out/i,
    /fewer guests/i,
    /more guests/i,
    /close/i,
    /previous month/i,
    /next month/i,
    /pay/i,
    /purchase/i,
    /place order/i,
    /complete reservation/i,
  ];

  for (let step = 0; step < 8; step += 1) {
    if (await checkoutReached(page, cfg, `checkout loop step ${step}`)) return "checkout";

    const bookingCard = await clickFirstSelector(
      page,
      cfg,
      '[data-testid="booking-card-button"]',
      "booking card",
      blockedLabels,
    );
    if (bookingCard) {
      log(`Clicked Tock booking card: ${bookingCard}`);
      if (await waitForCheckoutAfterAction(page, cfg, `after booking card ${bookingCard}`)) return "checkout";
      await page.waitForLoadState("domcontentloaded", { timeout: 2_000 }).catch(() => {});
      await sleep(cfg.actionSettleMs);
      if (await checkoutReached(page, cfg, `after booking card settle ${bookingCard}`)) return "checkout";
      continue;
    }

    const reserve = await clickFirstButton(
      page,
      cfg,
      [/^Reserve$/i, /Reserve now/i, /Reserve at/i, /^Book$/i, /Book now/i],
      blockedLabels,
    );
    if (reserve) {
      log(`Clicked booking button: ${reserve}`);
      if (await waitForCheckoutAfterAction(page, cfg, `after booking button ${reserve}`)) return "checkout";
      await page.waitForLoadState("domcontentloaded", { timeout: 2_000 }).catch(() => {});
      await sleep(cfg.actionSettleMs);
      if (await checkoutReached(page, cfg, `after booking settle ${reserve}`)) return "checkout";
      continue;
    }

    const time = await clickFirstButton(page, cfg, timeRegexes(cfg), blockedLabels);
    if (time) {
      log(`Clicked time: ${time}`);
      await page.waitForURL((url) => checkoutUrlLike(url.toString()), { timeout: 1_500 }).catch(() => {});
      if (await checkoutReached(page, cfg, `after time ${time}`)) return "checkout";
      await sleep(cfg.actionSettleMs);
      if (await checkoutReached(page, cfg, `after time settle ${time}`)) return "checkout";
      continue;
    }

    const selectedOption = await selectFirstMatchingOption(page, timeRegexes(cfg));
    if (selectedOption) {
      log(`Selected time option: ${selectedOption}`);
      await page.waitForURL((url) => checkoutUrlLike(url.toString()), { timeout: 1_500 }).catch(() => {});
      if (await checkoutReached(page, cfg, `after time option ${selectedOption}`)) return "checkout";
      await sleep(cfg.actionSettleMs);
      if (await checkoutReached(page, cfg, `after time option settle ${selectedOption}`)) return "checkout";
      continue;
    }

    const next = await clickFirstButton(
      page,
      cfg,
      [/^Select$/i, /^Continue$/i, /^Next$/i, /^Checkout$/i],
      blockedLabels,
    );
    if (next) {
      log(`Clicked next step: ${next}`);
      if (await waitForCheckoutAfterAction(page, cfg, `after next step ${next}`)) return "checkout";
      await page.waitForLoadState("domcontentloaded", { timeout: 2_000 }).catch(() => {});
      await sleep(cfg.actionSettleMs);
      if (await checkoutReached(page, cfg, `after next settle ${next}`)) return "checkout";
      continue;
    }

    if (cfg.lastClickFailure && /book|reserve|select|continue|next|checkout/i.test(cfg.lastClickFailure.label || "")) {
      log(`Holding current page after failed action click: ${cfg.lastClickFailure.label}`);
      await sleep(cfg.recoveryWaitMs);
      if (await checkoutReached(page, cfg, `after failed action recovery ${cfg.lastClickFailure.label}`)) {
        return "checkout";
      }
      continue;
    }

    return null;
  }

  return (await checkoutReached(page, cfg, "checkout loop final check")) ? "checkout" : null;
}

async function scanDatesAndReserve(page, cfg) {
  await openAvailabilitySurface(page, cfg);

  for (const partySize of cfg.partySizes) {
    cfg.partySize = partySize;
    const partyReady = await ensurePartySize(page, cfg);
    if (!partyReady) log(`Could not confirm party size ${cfg.partySize}; continuing anyway.`);

    if (cfg.opportunisticFirst) {
      const immediate = await clickTowardCheckout(page, cfg);
      if (immediate) return { ok: true, result: immediate, date: "current visible slot", partySize: cfg.partySize };
    }

    for (const date of datesToTry(cfg)) {
      const selected = await selectDateIfAvailable(page, cfg, date);
      if (!selected) continue;
      log(`Checking date ${date} for ${cfg.partySize}.`);

      const result = await clickTowardCheckout(page, cfg);
      if (result) return { ok: true, result, date, partySize: cfg.partySize };
    }
  }
  return { ok: false };
}

async function handleInitialPopups(page, cfg) {
  await clickFirstButton(page, cfg, [/accept all/i, /^accept$/i, /^agree$/i, /^ok$/i], []);
}

async function runReservation(cfg) {
  const releaseTs = new Date(cfg.releaseAt).getTime();
  const launchTs = releaseTs - cfg.leadMs;

  log(`Target release: ${formatPT(new Date(releaseTs))}`);
  log(`Party sizes: ${cfg.partySizes.join(", ")}`);
  log(`Profile: ${cfg.profileDir}`);
  log(`Fast network mode: ${cfg.fastNetwork ? "on" : "off"}`);

  if (!cfg.now && Date.now() < launchTs) {
    await waitUntil(launchTs, "Launching browser");
  }

  const { context, page } = await launchBrowser(cfg);
  if (cfg.fastNetwork) {
    await installFastNetworkRoutes(context);
  }
  page.on("dialog", async (dialog) => {
    log(`Browser dialog: ${dialog.message()}`);
    await dialog.dismiss().catch(() => {});
  });
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && checkoutUrlLike(frame.url()) && !cfg.checkoutSeen) {
      cfg.checkoutSeen = true;
      cfg.checkoutSeenUrl = frame.url();
      log(`Checkout navigation latched: ${frame.url()}`);
    }
  });

  await page.goto(buildSearchUrl(cfg), { waitUntil: "domcontentloaded", timeout: 20_000 });
  if (await checkoutReached(page, cfg, "initial navigation")) {
    notify("Tock reservation action needed", "Reached checkout. Complete checkout in the browser.");
    await holdOpen(context, cfg);
    return;
  }
  await page.waitForLoadState("networkidle", { timeout: cfg.reloadSettleMs }).catch(() => {});
  await handleInitialPopups(page, cfg);
  await waitForTockRender(page, cfg, "initial navigation");

  if (!cfg.now && Date.now() < releaseTs) {
    await openAvailabilitySurface(page, cfg);
    await waitForTockRender(page, cfg, "pre-release availability open");
    await ensurePartySize(page, cfg);
    await waitUntil(releaseTs, "Starting release refresh");
  }

  const stopAt = Date.now() + cfg.stopAfterMs;
  const firstAttemptAt = Date.now();
  let attempt = 0;
  while (Date.now() < stopAt) {
    if (await checkoutReached(page, cfg, "before refresh")) {
      notify("Tock reservation action needed", "Reached checkout. Complete checkout in the browser.");
      await holdOpen(context, cfg);
      return;
    }
    attempt += 1;
    log(`Attempt ${attempt}: refreshing availability.`);
    cfg.partySize = cfg.partySizes[0];
    await page.goto(buildSearchUrl(cfg, true), { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(async (error) => {
      log(`Refresh failed: ${error.message}`);
      if (await checkoutReached(page, cfg, "after refresh failure")) return;
      await page.reload({ waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => {});
    });
    if (await checkoutReached(page, cfg, "after refresh")) {
      notify("Tock reservation action needed", "Reached checkout. Complete checkout in the browser.");
      await holdOpen(context, cfg);
      return;
    }
    await page.waitForLoadState("networkidle", { timeout: cfg.reloadSettleMs }).catch(() => {});
    await waitForTockRender(page, cfg, "refresh");
    if (await checkoutReached(page, cfg, "after refresh settle")) {
      notify("Tock reservation action needed", "Reached checkout. Complete checkout in the browser.");
      await holdOpen(context, cfg);
      return;
    }
    await handleInitialPopups(page, cfg);

    const text = await pageText(page);
    if (/captcha|verify you are human|unusual traffic/i.test(text)) {
      notify("Tock needs manual attention", "A verification screen appeared. Use the open browser window.");
      await holdOpen(context, cfg);
      return;
    }

    const result = await scanDatesAndReserve(page, cfg);
    if (result.ok) {
      notify(
        "Tock reservation action needed",
        `Reached ${result.result} for ${result.partySize || cfg.partySize} on ${result.date || "an available date"}. Complete checkout in the browser.`,
      );
      await holdOpen(context, cfg);
      return;
    }

    if (/new reservations will be released/i.test(text)) {
      log("Still seeing the pre-release/sold-out page.");
    } else if (/sold out/i.test(text)) {
      log("Availability is still sold out for visible dates.");
    } else {
      log("No booking button found yet.");
    }

    const inBurst = Date.now() - firstAttemptAt < cfg.burstForMs;
    const pollMs = inBurst ? cfg.burstPollMs : cfg.pollMs;
    const jitter = Math.floor(Math.random() * Math.min(cfg.jitterMs, inBurst ? 75 : 250));
    await sleep(pollMs + jitter);
  }

  notify("Tock helper stopped", `No reservable slot found within ${duration(cfg.stopAfterMs)}.`);
  await context.close();
}

async function holdOpen(context, cfg) {
  if (process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await rl.question("Browser is open. Finish manually, then press Enter here to close...");
    rl.close();
    await context.close();
    return;
  }

  log(`No terminal prompt available; keeping browser open for ${duration(cfg.holdAfterSuccessMs)}.`);
  await sleep(cfg.holdAfterSuccessMs);
  await context.close();
}

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  if (cfg.login) {
    await runLogin(cfg);
  } else {
    await runReservation(cfg);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
