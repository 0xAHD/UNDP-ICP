// Open a credential LINK and capture what a verifier sees, with no interaction.
import { chromium } from "playwright";
import fs from "node:fs";
const [url, label, selArg] = process.argv.slice(2);
// Default waits for a verdict; pass a selector to capture other states.
const sel = selArg ?? "#result .verdict";
if (!url) { console.error("usage: <credentialLink> [label]"); process.exit(2); }
fs.mkdirSync("/tmp/shots", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 860, height: 900 }, deviceScaleFactor: 2 });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForSelector(sel, { timeout: 60000 });
await page.waitForTimeout(400);

const v = await page.$("#result .verdict h2");
console.log("verdict      :", v ? (await v.textContent()).trim() : "(none — input state)");
console.log("input hidden :", await page.$eval("#input", (e) => e.classList.contains("hidden")));
const file = `/tmp/shots/${label ?? "link"}.png`;
await page.screenshot({ path: file, fullPage: true });
if (errs.length) console.log("console errors:", errs.join(" | "));
console.log("shot         :", file);
await browser.close();
