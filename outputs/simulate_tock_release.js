#!/usr/bin/env node
import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";

const requestedDates = [
  "2026-06-24",
];
const availableDates = ["2026-06-24"];
const availablePartySizes = [4];
const releaseAt = Date.now() + 6_000;
let checkoutHit = null;
let leftCheckoutHit = null;

function htmlForPage(url) {
  const query = new URL(url, "http://127.0.0.1").searchParams;
  const initialDate = query.get("date") || requestedDates[0];
  const initialPartySize = Number(query.get("size") || 3);
  const released = Date.now() >= releaseAt;

  if (!released) {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Simulation - Fu Hui Hua Tock</title>
  <style>
    body { font: 16px system-ui, sans-serif; margin: 40px; }
  </style>
</head>
<body>
  <main>
    <h1>Fù Huì Huá 馥薈華</h1>
    <p>San Francisco, CA · Asian · $$$</p>
    <p>Today 5:00 PM – 11:00 PM</p>
    <h2>Reservations are unavailable.</h2>
    <p>Fù Huì Huá 馥薈華 is not currently accepting reservations on Tock. Please check again soon.</p>
  </main>
</body>
</html>`;
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Simulation - Fu Hui Hua Tock</title>
  <style>
    body { font: 16px system-ui, sans-serif; margin: 40px; }
    button { margin: 6px; padding: 10px 14px; }
    [aria-current="date"] { outline: 3px solid #2454ff; }
    .time-card { border: 1px solid #ccc; padding: 12px; margin-top: 12px; max-width: 260px; }
    .overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(255,255,255,0.01); }
  </style>
</head>
<body>
  <main>
    <h1>Fù Huì Huá 馥薈華</h1>
    <p>San Francisco, CA · Asian · $$$</p>
    <aside aria-label="Behind-page search controls">
      <p>Party size</p>
      <p id="outer-party-size-label">2 guests</p>
      <button aria-label="Fewer guests" type="button" data-outer-control="minus">-</button>
      <button aria-label="More guests" type="button" data-outer-control="plus">+</button>
      <button type="button" aria-label="2026-06-24" data-outer-control="date">24</button>
    </aside>
    <section role="dialog" aria-label="Search availability for Winter's Depth, Spring Approaches experience at Fù Huì Huá">
      <h2>Winter's Depth, Spring Approaches experience</h2>
      <div>
        <p>Party size</p>
        <p id="party-size-label">${initialPartySize} guests</p>
        <button aria-label="Fewer guests" type="button">-</button>
        <button aria-label="More guests" type="button">+</button>
      </div>
      <button id="date-summary" type="button" aria-label="Desired reservation date, current selection is ${initialDate}">
        Date ${initialDate}
      </button>
      <div id="dates">
        ${requestedDates.map((date) => `<button type="button" data-date="${date}">${date}</button>`).join("\n")}
      </div>
      <div id="availability" aria-live="polite"></div>
    </section>
  </main>
  <script>
    const released = ${JSON.stringify(released)};
    const availableDates = ${JSON.stringify(availableDates)};
    const availablePartySizes = ${JSON.stringify(availablePartySizes)};
    const dialog = document.querySelector('[role="dialog"]');
    let outerPartySize = 2;
    let selectedDate = ${JSON.stringify(initialDate)};
    let selectedPartySize = ${JSON.stringify(initialPartySize)};
    let availabilityTimer = null;

    function render() {
      document.getElementById("party-size-label").textContent = selectedPartySize + " guests";
      document.querySelectorAll("[data-date]").forEach((button) => {
        if (button.dataset.date === selectedDate) {
          button.setAttribute("aria-current", "date");
        } else {
          button.removeAttribute("aria-current");
        }
      });
      document.getElementById("date-summary").textContent = "Date " + selectedDate;
      document.getElementById("date-summary").setAttribute(
        "aria-label",
        "Desired reservation date, current selection is " + selectedDate
      );

      const availability = document.getElementById("availability");
      clearTimeout(availabilityTimer);
      if (!released) {
        availability.innerHTML = '<div role="alert">All reservations sold out. New reservations will be released soon.</div><button type="button">Notify</button>';
        return;
      }

      if (!availableDates.includes(selectedDate) || !availablePartySizes.includes(selectedPartySize)) {
        availability.innerHTML = '<div role="alert">Winter\\'s Depth, Spring Approaches experience is not offered on ' + selectedDate + ' for ' + selectedPartySize + ' guests.</div><button type="button">Notify</button>';
        return;
      }

      availability.innerHTML = '<div aria-live="polite">Loading available times...</div>';
      availabilityTimer = setTimeout(() => {
        availability.innerHTML = '<div class="time-card"><div>8:00 PM</div><div>$258 × ' + selectedPartySize + '</div><button id="book" data-testid="booking-card-button" type="button">Book</button></div>';
        document.getElementById("book").addEventListener("click", () => {
          setTimeout(() => {
            window.location.href = "/checkout/confirm-purchase?date=" + encodeURIComponent(selectedDate) + "&size=" + selectedPartySize;
          }, 2200);
        });
      }, 800);
    }

    dialog.querySelector('[aria-label="Fewer guests"]').addEventListener("click", () => {
      selectedPartySize = Math.max(1, selectedPartySize - 1);
      history.replaceState(null, "", "?date=" + encodeURIComponent(selectedDate) + "&size=" + selectedPartySize);
      render();
    });
    dialog.querySelector('[aria-label="More guests"]').addEventListener("click", () => {
      selectedPartySize += 1;
      history.replaceState(null, "", "?date=" + encodeURIComponent(selectedDate) + "&size=" + selectedPartySize);
      render();
    });
    document.querySelectorAll('[data-outer-control]').forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopImmediatePropagation();
        if (button.dataset.outerControl === "plus") outerPartySize += 1;
        if (button.dataset.outerControl === "minus") outerPartySize = Math.max(1, outerPartySize - 1);
        document.getElementById("outer-party-size-label").textContent = outerPartySize + " guests";
      });
    });
    document.querySelectorAll("[data-date]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedDate = button.dataset.date;
        history.replaceState(null, "", "?date=" + encodeURIComponent(selectedDate) + "&size=" + selectedPartySize);
        render();
      });
    });
    render();
  </script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  if (req.url?.startsWith("/checkout")) {
    checkoutHit = req.url;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><title>Checkout</title><main><h1>Checkout</h1><p>Complete your reservation.</p></main>`);
    return;
  }

  if (checkoutHit && (req.url === "/" || req.url?.startsWith("/fui-hui-hua-simulation"))) {
    leftCheckoutHit = req.url || "/";
  }

  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(htmlForPage(req.url || "/"));
});

function waitForServerListening(serverToWaitFor) {
  return new Promise((resolve) => serverToWaitFor.listen(0, "127.0.0.1", resolve));
}

function runHelper(pageUrl, profileDir) {
  const helperPath = path.join(process.cwd(), "fuhuihua_tock_reservation.js");
  const releaseIso = new Date(releaseAt).toISOString();
  const args = [
    helperPath,
    "--page-url",
    pageUrl,
    "--release-at",
    releaseIso,
    "--date",
    requestedDates[0],
    "--dates",
    requestedDates.join(","),
    "--party-sizes",
    "4",
    "--scan-days",
    "0",
    "--closed-weekdays",
    "1,2",
    "--no-opportunistic-first",
    "--lead-ms",
    "4000",
    "--burst-poll-ms",
    "300",
    "--burst-for-ms",
    "5000",
    "--poll-ms",
    "750",
    "--reload-settle-ms",
    "300",
    "--open-settle-ms",
    "100",
    "--action-settle-ms",
    "100",
    "--date-settle-ms",
    "50",
    "--click-timeout-ms",
    "4000",
    "--click-retries",
    "2",
    "--recovery-wait-ms",
    "2500",
    "--jitter-ms",
    "0",
    "--stop-after-ms",
    "12000",
    "--hold-after-success-ms",
    "500",
    "--profile-dir",
    profileDir,
    "--artifact-dir",
    path.join(profileDir, "artifacts"),
    "--browser-channel=",
    "--headless",
    "--fast-network",
  ];

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on("exit", (code) => resolve({ code, output }));
  });
}

await waitForServerListening(server);
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/fui-hui-hua-simulation`;
const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), "fuhuihua-sim-profile-"));

console.log(`Simulation server: ${baseUrl}`);
console.log(`Fake release: ${new Date(releaseAt).toISOString()}`);
console.log(`Only available simulated date: ${availableDates.join(", ")}`);
console.log(`Only available simulated party size: ${availablePartySizes.join(", ")}`);

try {
  const result = await runHelper(baseUrl, profileDir);
  const passed =
    result.code === 0 &&
    checkoutHit?.includes("date=2026-06-24") &&
    checkoutHit?.includes("size=4") &&
    !leftCheckoutHit &&
    /Reached checkout/.test(result.output);

  if (!passed) {
    console.error("\nSIMULATION FAILED");
    console.error(`helper exit code: ${result.code}`);
    console.error(`checkout hit: ${checkoutHit || "(none)"}`);
    console.error(`left checkout hit: ${leftCheckoutHit || "(none)"}`);
    process.exitCode = 1;
  } else {
    console.log("\nSIMULATION PASSED");
    console.log(`Reached simulated checkout: ${checkoutHit}`);
  }
} finally {
  server.close();
  await fs.rm(profileDir, { recursive: true, force: true });
}
