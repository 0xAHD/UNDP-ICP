#!/usr/bin/env node
// Off-chain issuer tool. Holds the issuer PRIVATE KEY — which is exactly what
// phase2-decisions §3 option C means: the canister never signs.
//
//   node scripts/issue-credential.mjs setup
//   node scripts/issue-credential.mjs issue "Jane Doe" altfinlab-2026 founder
//   node scripts/issue-credential.mjs revoke <credential.json>
//
// Writes each credential to credentials/<credentialId>.json — that file IS the
// credential the holder keeps. It contains personal data and must never be
// committed or put on chain.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import QRCode from "qrcode";
import { digestOf, toHex, canonicalBytes } from "../shared-js/credential.mjs";

const ENV = "local", CAN = "registry", IDENT = process.env.IDENTITY ?? "ct-admin-a";
const KEYFILE = ".issuer-key.json";
const OUTDIR = "credentials";

/// Where the verification page lives. Looked up from the deployed canister so
/// the link works without hardcoding an id.
function pageOrigin() {
  if (process.env.VERIFY_PAGE_URL) return process.env.VERIFY_PAGE_URL.replace(/\/$/, "");
  try {
    const id = execFileSync("icp", ["canister", "status", "verify_page", "-e", ENV, "--identity", IDENT],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, DO_NOT_TRACK: "1" } })
      .match(/Canister Id:\s*(\S+)/)?.[1];
    return id ? `http://${id}.localhost:8000` : null;
  } catch { return null; }
}

/// The document rides in the URL FRAGMENT, which browsers never send to a
/// server — so the holder's name never leaves their machine when a verifier
/// opens the link.
function verifyLink(doc) {
  const origin = pageOrigin();
  if (!origin) return null;
  const b64 = Buffer.from(canonicalBytes(doc)).toString("base64url");
  return `${origin}/#${b64}`;
}

const icp = (method, args) => {
  try {
    return execFileSync("icp", ["canister", "call", CAN, method, args,
      "-e", ENV, "--identity", IDENT],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, DO_NOT_TRACK: "1" } }).trim();
  } catch (e) { return ((e.stdout || "") + (e.stderr || "")).trim(); }
};
const toBlob = (u8) => `blob "${[...u8].map(b => "\\" + b.toString(16).padStart(2, "0")).join("")}"`;

function loadKey() {
  if (!fs.existsSync(KEYFILE)) {
    throw new Error(`no issuer key yet — run: node scripts/issue-credential.mjs setup`);
  }
  const j = JSON.parse(fs.readFileSync(KEYFILE, "utf8"));
  return {
    keyId: j.keyId,
    privateKey: crypto.createPrivateKey({ key: Buffer.from(j.privateKeyPem, "base64").toString(), format: "pem" }),
    publicKeyRaw: Buffer.from(j.publicKeyHex, "hex"),
  };
}

const cmd = process.argv[2];

if (cmd === "setup") {
  // Generate the issuer keypair and register its PUBLIC half with the registry.
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const rawPub = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const reply = icp("addIssuerKey", `(${toBlob(rawPub)})`);
  const keyId = reply.match(/ok = ([0-9_]+)/)?.[1]?.replace(/_/g, "");
  if (keyId === undefined) throw new Error(`addIssuerKey failed: ${reply}`);
  fs.writeFileSync(KEYFILE, JSON.stringify({
    keyId: Number(keyId),
    publicKeyHex: rawPub.toString("hex"),
    privateKeyPem: Buffer.from(privateKey.export({ format: "pem", type: "pkcs8" })).toString("base64"),
  }, null, 2));
  console.log(`issuer key registered as id ${keyId}`);
  console.log(`public key : ${rawPub.toString("hex")}`);
  console.log(`private key: ${KEYFILE}  (gitignored — never commit, never put on chain)`);
  process.exit(0);
}

if (cmd === "issue") {
  const [holder, cohort, role] = process.argv.slice(3);
  if (!holder || !cohort || !role) {
    console.error('usage: issue "<holder>" <cohort> <role>'); process.exit(2);
  }
  const { keyId, privateKey } = loadKey();
  const doc = {
    v: 1,
    // 128 bits of randomness. This is what makes publishing the digest safe.
    credentialId: crypto.randomBytes(16).toString("hex"),
    holder, cohort, role,
    outcome: "completed",
    issuedOn: new Date().toISOString().slice(0, 10),
  };
  const digest = await digestOf(doc);
  const signature = crypto.sign(null, digest, privateKey);
  const reply = icp("issue", `(${toBlob(digest)}, ${keyId}, ${toBlob(signature)})`);
  if (!reply.includes("ok")) { console.error(`issue failed: ${reply}`); process.exit(1); }
  fs.mkdirSync(OUTDIR, { recursive: true });
  const file = path.join(OUTDIR, `${doc.credentialId}.json`);
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  console.log(`issued  : ${holder} / ${cohort} / ${role}`);
  console.log(`digest  : ${toHex(digest)}`);
  console.log(`document: ${file}`);

  const link = verifyLink(doc);
  if (link) {
    const qrFile = path.join(OUTDIR, `${doc.credentialId}.qr.svg`);
    fs.writeFileSync(qrFile, await QRCode.toString(link, { type: "svg", margin: 1 }));
    console.log(`\nGive the holder either of these — no JSON, no pasting:`);
    console.log(`  link : ${link}`);
    console.log(`  qr   : ${qrFile}   <- for showing on a phone, in person`);
  } else {
    console.log(`\n(verify_page not deployed — no link generated)`);
  }
  process.exit(0);
}

if (cmd === "revoke") {
  const file = process.argv[3];
  if (!file) { console.error("usage: revoke <credential.json>"); process.exit(2); }
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const digest = await digestOf(doc);
  const reply = icp("revoke", `(${toBlob(digest)})`);
  console.log(reply.includes("ok") ? `revoked : ${toHex(digest)}` : `revoke failed: ${reply}`);
  process.exit(reply.includes("ok") ? 0 : 1);
}

console.error("commands: setup | issue | revoke");
process.exit(2);
