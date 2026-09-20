// Drive the deployed verification page in a real browser and capture each
// verdict. Proves the page works end to end against the local replica.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const url = process.argv[2];
const credFile = process.argv[3];
const label = process.argv[4] ?? "shot";
if (!url || !credFile) { console.error("usage: <pageUrl> <credential.json> [label]"); process.exit(2); }

const doc = fs.readFileSync(credFile, "utf8");
const outDir = "/tmp/shots"; fs.mkdirSync(outDir, { recursive: true });

// The image ships a pinned Chromium; the npm playwright build may expect a
// different one. Use the image's binary rather than downloading (see the
// environment's PLAYWRIGHT_BROWSERS_PATH note).
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 860, height: 1100 }, deviceScaleFactor: 2 });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.fill("#doc", doc);
await page.click("#go");
// Wait for a verdict to render (update call goes through consensus, ~2s)
await page.waitForSelector("#result .verdict", { timeout: 60000 });
await page.waitForTimeout(400);

const verdict = await page.textContent("#result .verdict h2");
const checks = await page.$$eval("#result .checks li", (els) => els.map((e) => e.textContent.trim()));
const file = path.join(outDir, `${label}.png`);
await page.screenshot({ path: file, fullPage: true });

console.log(`verdict : ${verdict}`);
checks.forEach((c) => console.log(`  ${c}`));
if (errors.length) console.log(`console errors: ${errors.join(" | ")}`);
console.log(`shot    : ${file}`);
await browser.close();
process.exit(0);
