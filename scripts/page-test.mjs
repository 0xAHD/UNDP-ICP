#!/usr/bin/env node
// Browser regression suite for the verification page. Runs against the local
// replica and asserts what a verifier actually sees — the page is the product
// surface, so a break here matters as much as a canister break.
//
// Expects: local network up, admins seeded, an issuer key registered.
import { chromium } from "playwright";
import fsx from "node:fs";

const preferred = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const chromiumPath = fsx.existsSync(preferred) ? preferred : null;
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { digestOf, canonicalBytes } from "../shared-js/credential.mjs";

const ENV = "local", IDENT = process.env.IDENTITY ?? "ct-admin-a";
let pass = 0, fail = 0;

const icp = (canister, method, args) => {
  try {
    return execFileSync("icp", ["canister", "call", canister, method, args, "-e", ENV, "--identity", IDENT],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, DO_NOT_TRACK: "1" } }).trim();
  } catch (e) { return ((e.stdout || "") + (e.stderr || "")).trim(); }
};
const canisterId = (name) =>
  execFileSync("icp", ["canister", "status", name, "-e", ENV, "--identity", IDENT],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, DO_NOT_TRACK: "1" } })
    .match(/Canister Id:\s*(\S+)/)?.[1];
const toBlob = (u8) => `blob "${[...u8].map(b => "\\" + b.toString(16).padStart(2, "0")).join("")}"`;

const check = (label, got, want) => {
  const ok = String(got).includes(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(44)} ${ok ? "" : `got:${got} want:${want}`}`);
  ok ? pass++ : fail++;
};

// --- set up an issuer key and a credential to look at -----------------------
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const rawPub = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
const added = icp("registry", "addIssuerKey", `(${toBlob(rawPub)})`);
const keyId = added.match(/ok = ([0-9_]+)/)?.[1]?.replace(/_/g, "");
if (keyId === undefined) { console.error(`addIssuerKey failed: ${added}`); process.exit(1); }

const mkDoc = (holder) => ({
  v: 1, credentialId: crypto.randomBytes(16).toString("hex"),
  holder, cohort: "altfinlab-2026", role: "founder",
  outcome: "completed", issuedOn: new Date().toISOString().slice(0, 10),
});
const issue = async (doc) => {
  const d = await digestOf(doc);
  const sig = crypto.sign(null, d, privateKey);
  const r = icp("registry", "issue", `(${toBlob(d)}, ${keyId}, ${toBlob(sig)})`);
  if (!r.includes("ok")) throw new Error(`issue failed: ${r}`);
  return d;
};

const good = mkDoc("Amina Yusuf");
await issue(good);
const doomed = mkDoc("Kwame Mensah");
const doomedDigest = await issue(doomed);
icp("registry", "revoke", `(${toBlob(doomedDigest)})`);
const neverIssued = mkDoc("Nobody AtAll");

const PAGE = `http://${canisterId("verify_page")}.localhost:8000`;
const link = (doc) => `${PAGE}/#${Buffer.from(canonicalBytes(doc)).toString("base64url")}`;

// --- drive the page ---------------------------------------------------------
const browser = await chromium.launch({
  // Use a pre-staged Chromium when one exists (this image ships one); fall
  // back to playwright's own download, which is what a CI runner will have.
  ...(chromiumPath ? { executablePath: chromiumPath } : {}),
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 860, height: 900 } });

async function visit(url, waitFor = "#result .verdict") {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(waitFor, { timeout: 60000 });
  const verdict = await page.$("#result .verdict h2");
  return {
    page, errors,
    verdict: verdict ? (await verdict.textContent()).trim() : "",
    body: await page.textContent("body"),
    inputHidden: await page.$eval("#input", (e) => e.classList.contains("hidden")),
  };
}

console.log(`PAGE: ${PAGE}\n`);
console.log("-- a valid credential link --");
let r = await visit(link(good));
check("verdict is Valid", r.verdict, "Valid credential");
check("input is hidden (nothing to ask)", String(r.inputHidden), "true");
check("holder is shown", r.body, "Amina Yusuf");
check("signature check passes", r.body, "signature verifies against the issuer key");
check("no console errors", r.errors.join("|") || "none", "none");

console.log("\n-- a revoked credential --");
r = await visit(link(doomed));
check("verdict is Revoked", r.verdict, "Revoked");
check("signature STILL verifies", r.body, "signature verifies against the issuer key");
check("revocation date shown", r.body, "Revoked on");

console.log("\n-- a tampered document --");
const tampered = { ...good, holder: good.holder + "-Smith" };
r = await visit(link(tampered));
check("verdict is Not a known credential", r.verdict, "Not a known credential");

console.log("\n-- a digest never issued --");
r = await visit(link(neverIssued));
check("verdict is Not a known credential", r.verdict, "Not a known credential");

console.log("\n-- a damaged link --");
r = await visit(`${PAGE}/#not-valid-base64!!`);
check("verdict is Broken credential link", r.verdict, "Broken credential link");
check("input shown so they can recover", String(r.inputHidden), "false");

console.log("\n-- landing page, no link --");
r = await visit(`${PAGE}/`, "#drop");
check("drop zone shown", r.body, "Drop the credential file here");
check("no verdict yet", r.verdict || "none", "none");

await browser.close();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
