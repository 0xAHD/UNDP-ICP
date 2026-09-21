#!/usr/bin/env node
// Browser regression suite for the ops console. Runs against the local replica.
//
// SCOPE, stated plainly: this drives the SIGNED-OUT console. The Internet
// Identity sign-in ceremony itself is not exercised here — it needs a real
// identity provider and a human at the keyboard, and it is not what this suite
// is for. What it does cover is everything the console decides on its own:
// that an unauthenticated visitor sees read-only state and no privileged
// control, that the canister data renders correctly, and that the page reaches
// nothing but the replica.
//
// The authorisation that actually matters is enforced in the canisters and
// covered by the adversarial suites — this page is a convenience, never a
// security boundary.
//
// Expects: local network up, admins seeded.
import { chromium } from "playwright";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fsx from "node:fs";
import { digestOf } from "../shared-js/credential.mjs";

const preferred = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const chromiumPath = fsx.existsSync(preferred) ? preferred : null;

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
const toHex = (u8) => [...u8].map(b => b.toString(16).padStart(2, "0")).join("");

const check = (label, got, want) => {
  const ok = String(got).includes(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(48)} ${ok ? "" : `got:${got} want:${want}`}`);
  ok ? pass++ : fail++;
};
const checkNot = (label, got, unwanted) => {
  const ok = !String(got).includes(unwanted);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(48)} ${ok ? "" : `found:${unwanted}`}`);
  ok ? pass++ : fail++;
};

// --- state for the console to render ---------------------------------------
// Unique ids so this suite can run alongside the others without colliding.
const tag = crypto.randomBytes(3).toString("hex");
const openCohort = `console-open-${tag}`;
const shutCohort = `console-shut-${tag}`;

for (const [c, r] of [[openCohort, null], [shutCohort, "close"]]) {
  const o = icp("ops", "openCohort", `("${c}")`);
  if (!o.includes("ok")) { console.error(`openCohort ${c} failed: ${o}`); process.exit(1); }
  const s = icp("ops", "setCompletionRule", `("${c}", "founder", vec { "pitch-training"; "demo-day" })`);
  if (!s.includes("ok")) { console.error(`setCompletionRule ${c} failed: ${s}`); process.exit(1); }
  if (r === "close") {
    const x = icp("ops", "closeCohort", `("${c}")`);
    if (!x.includes("ok")) { console.error(`closeCohort ${c} failed: ${x}`); process.exit(1); }
  }
}

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const rawPub = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
const added = icp("registry", "addIssuerKey", `(${toBlob(rawPub)})`);
const keyId = added.match(/ok = ([0-9_]+)/)?.[1]?.replace(/_/g, "");
if (keyId === undefined) { console.error(`addIssuerKey failed: ${added}`); process.exit(1); }

const mkDoc = (holder) => ({
  v: 1, credentialId: crypto.randomBytes(16).toString("hex"),
  holder, cohort: openCohort, role: "founder",
  outcome: "completed", issuedOn: new Date().toISOString().slice(0, 10),
});
const issue = async (doc) => {
  const d = await digestOf(doc);
  const sig = crypto.sign(null, d, privateKey);
  const r = icp("registry", "issue", `(${toBlob(d)}, ${keyId}, ${toBlob(sig)})`);
  if (!r.includes("ok")) throw new Error(`issue failed: ${r}`);
  return d;
};

const activeDigest = await issue(mkDoc("Amina Yusuf"));
const revokedDigest = await issue(mkDoc("Kwame Mensah"));
icp("registry", "revoke", `(${toBlob(revokedDigest)})`);
const unknownDigest = crypto.randomBytes(32);

// --- drive the console ------------------------------------------------------
const CONSOLE = `http://${canisterId("ops_console")}.localhost:8000`;
console.log(`CONSOLE: ${CONSOLE}\n`);

const browser = await chromium.launch({
  ...(chromiumPath ? { executablePath: chromiumPath } : {}),
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 1100, height: 1200 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

// Every request the console makes, so a third-party call cannot creep in.
const hosts = new Set();
page.on("request", (r) => { try { hosts.add(new URL(r.url()).hostname); } catch {} });

await page.goto(`${CONSOLE}/`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#cohorts table", { timeout: 60000 });
await page.waitForSelector("#issuerKeys table", { timeout: 60000 });

console.log("-- signed out --");
check("principal reads 'Not signed in'", await page.textContent("#principal"), "Not signed in");
check("sign-in offered", String(await page.isVisible("#signin")), "true");
check("sign-out hidden", String(await page.isVisible("#signout")), "false");
check("no admin pill before sign-in", (await page.textContent("#adminState")).trim() || "none", "none");
check("'Open cohort' disabled", String(await page.isDisabled("#openCohort")), "true");
check("'Set rule' disabled", String(await page.isDisabled("#setRule")), "true");
check("no Close buttons offered", String((await page.$$("[data-close]")).length), "0");

console.log("\n-- cohorts render from the canister --");
const cohortsText = await page.textContent("#cohorts");
check("open cohort listed", cohortsText, openCohort);
check("open cohort shows Open", cohortsText, "Open");
check("closed cohort listed", cohortsText, shutCohort);
check("closed cohort shows Closed", cohortsText, "Closed");
check("completion rule shown", cohortsText, "founder: pitch-training, demo-day");

console.log("\n-- issuer keys render from the registry --");
check("issuer key public key shown", await page.textContent("#issuerKeys"), toHex(rawPub));

console.log("\n-- credential lookup (anonymous) --");
const lookup = async (hex) => {
  await page.fill("#digest", hex);
  await page.click("#lookup");
  await page.waitForFunction(() => document.querySelector("#credResult").innerHTML.trim() !== "",
    null, { timeout: 60000 });
  return page.textContent("#credResult");
};
check("active credential reads Active", await lookup(toHex(activeDigest)), "Active");
check("no Revoke button for a non-admin", String((await page.$$("#revoke")).length), "0");
check("revoked credential reads Revoked", await lookup(toHex(revokedDigest)), "Revoked");
check("unknown digest says so", await lookup(toHex(unknownDigest)), "no record");
check("malformed digest is rejected client-side", await lookup("nonsense"), "64 hexadecimal characters");

console.log("\n-- scope and privacy --");
check("issuing is ruled out in the page itself", await page.textContent("body"), "issuer private key");
checkNot("no holder name reaches this console", await page.textContent("body"), "Amina Yusuf");
const offsite = [...hosts].filter((h) => !h.endsWith("localhost") && h !== "127.0.0.1");
check("nothing is fetched off the replica", offsite.length ? offsite.join(",") : "none", "none");
check("no console errors", errors.join("|") || "none", "none");

if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: true });

await browser.close();
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
