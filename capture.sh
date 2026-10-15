#!/usr/bin/env bash
# Capture desktop + mobile screenshots of the running app.
# Env: CAPTURE_URL (exact URL to open), CAPTURE_DIR (output dir, outside source).
# Writes final-desktop.png and final-mobile.png, leaves the app running.
# Exit 75 = temporary navigation/browser infrastructure failure; exit 1 = script/rendering defect.
# Per-command timing via /usr/bin/time -p (stderr only).
set -euo pipefail
cd "$(dirname "$0")"

/usr/bin/time -p test -n "${CAPTURE_URL:-}" || { echo "Set CAPTURE_URL." >&2; exit 1; }
/usr/bin/time -p test -n "${CAPTURE_DIR:-}" || { echo "Set CAPTURE_DIR." >&2; exit 1; }
case "$CAPTURE_URL" in
  http://*|https://*) ;;
  *) echo "CAPTURE_URL must start with http:// or https://." >&2; exit 1 ;;
esac
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"

/usr/bin/time -p node -e '
const { mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { createRequire } = require("node:module");
const url = process.env.CAPTURE_URL, output = process.env.CAPTURE_DIR;
if (!url || !output) { console.error("Set CAPTURE_URL and CAPTURE_DIR."); process.exit(1); }
mkdirSync(output, { recursive: true });
const runtime = join(process.env.HOME, ".local/share/omgithub-playwright");
const require2 = createRequire(join(runtime, "package.json"));
const { chromium } = require2("playwright");
const config = require("node:fs").readFileSync(join(runtime, process.platform === "darwin" ? "metal.json" : "linux.json"), "utf8");
const launchOptions = JSON.parse(config).browser.launchOptions;
if (process.platform === "linux") process.env.DISPLAY ||= ":" + require("node:fs").readFileSync(join(runtime, "display"), "utf8").trim();
const transient = (error) => { throw Object.assign(error instanceof Error ? error : new Error(String(error)), { exitCode: 75 }); };
(async () => {
  let browser;
  try {
    browser = await chromium.launch({ ...launchOptions, timeout: 30000 }).catch(transient);
    for (const [name, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } }).catch(transient);
      page.setDefaultTimeout(30000);
      page.on("pageerror", (error) => console.error(error.message));
      const response = await page.goto(url, { waitUntil: "load", timeout: 45000 }).catch(transient);
      if (!response?.ok()) throw Object.assign(new Error("HTTP " + response?.status() + " loading preview"), { exitCode: !response || [408, 429, 500, 502, 503, 504].includes(response.status()) ? 75 : 1 });
      await page.locator("body").waitFor({ state: "visible" });
      await page.waitForFunction(() => document.fonts.status === "loaded");
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(output, "final-" + name + ".png"), timeout: 30000 }).catch((error) => {
        if (error.name === "TimeoutError" || !browser.isConnected()) transient(error);
        throw error;
      });
      await page.close();
    }
  } catch (error) { console.error(error && error.message ? error.message : error); process.exitCode = error.exitCode || 1; }
  finally { await browser?.close().catch((error) => { console.error(error && error.message ? error.message : error); process.exitCode ||= 75; }); }
})();
'

/usr/bin/time -p test -f "$CAPTURE_DIR/final-desktop.png" || { echo "Missing final-desktop.png." >&2; exit 1; }
/usr/bin/time -p test -f "$CAPTURE_DIR/final-mobile.png" || { echo "Missing final-mobile.png." >&2; exit 1; }
/usr/bin/time -p node -e '
const fs = require("node:fs");
for (const n of ["final-desktop.png", "final-mobile.png"]) {
  const p = require("node:path").join(process.env.CAPTURE_DIR, n);
  const b = fs.readFileSync(p);
  if (b.length < 24 || b.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") { console.error("Not a PNG: " + n); process.exit(1); }
}
console.log("Captures verified.");
'
