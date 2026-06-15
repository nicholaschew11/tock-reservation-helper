#!/usr/bin/env node
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PAGE_URL =
  "https://www.exploretock.com/fui-hui-hua-san-francisco/experience/559289/winters-depth-spring-approaches-experience";

const cfg = {
  pageUrl: process.env.TOCK_PAGE_URL || DEFAULT_PAGE_URL,
  date: process.env.TOCK_DATE || "2026-06-24",
  partySize: process.env.TOCK_PARTY_SIZE || (process.env.TOCK_PARTY_SIZES || "4").split(",")[0].trim(),
  profileDir: process.env.TOCK_PROFILE_DIR || path.join(__dirname, "tock-profile"),
  browserChannel: process.env.TOCK_BROWSER_CHANNEL ?? "chrome",
  headless: process.env.TOCK_HEADLESS === "1",
  artifactDir: process.env.TOCK_PREFLIGHT_DIR || path.join(__dirname, "artifacts", "preflight"),
};

function buildUrl() {
  const url = new URL(cfg.pageUrl);
  url.searchParams.set("date", cfg.date);
  url.searchParams.set("size", cfg.partySize);
  return url.toString();
}

function datePattern(dateText) {
  const parsed = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateText;
  const month = parsed.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${dateText}|${month}\\s+${parsed.getUTCDate()},\\s+${parsed.getUTCFullYear()}`;
}

async function main() {
  const context = await chromium.launchPersistentContext(cfg.profileDir, {
    channel: cfg.browserChannel || undefined,
    headless: cfg.headless,
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    viewport: { width: 1440, height: 1000 },
  });

  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(buildUrl(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(1_500);

    const title = await page.title().catch(() => "");
    const body = await page.locator("body").innerText({ timeout: 3_000 }).catch(() => "");
    const normalized = body.replace(/\s+/g, " ");
    const result = {
      capturedAt: new Date().toISOString(),
      profileDir: cfg.profileDir,
      url: page.url(),
      title,
      checks: {
        cloudflareClear: !/security verification|not a bot|just a moment/i.test(`${title} ${body}`),
        targetPartyVisible: new RegExp(`\\b${cfg.partySize}\\s+guests?\\b`, "i").test(body),
        targetDateVisible: new RegExp(datePattern(cfg.date), "i").test(body),
        notOnCheckout: !/\/checkout(?:[/?#]|$)/i.test(page.url()),
      },
      bodyExcerpt: normalized.slice(0, 1800),
    };
    result.ok = Object.values(result.checks).every(Boolean);

    await fs.mkdir(cfg.artifactDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = path.join(cfg.artifactDir, `preflight_readiness_${stamp}.json`);
    await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ...result, outputPath }, null, 2));

    process.exitCode = result.ok ? 0 : 2;
  } finally {
    await context.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
