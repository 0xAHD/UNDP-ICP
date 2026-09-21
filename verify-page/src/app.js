// Public credential verification. Everything that matters happens here, in the
// browser — the page never asks a server to vouch for anything.
import { HttpAgent, Actor } from "@icp-sdk/core/agent";
import { safeGetCanisterEnv } from "@icp-sdk/core/agent/canister-env";
import { IDL } from "@icp-sdk/core/candid";
import * as ed from "@noble/ed25519";
import { digestOf, toHex } from "../../shared-js/credential.mjs";

// Root key and canister id come from the ic_env cookie the asset canister sets.
// NEVER fetchRootKey(): it trusts whatever the replica returns, and an
// environment branch is how that call leaks into production.
const env = safeGetCanisterEnv();
const canisterId = env?.["PUBLIC_CANISTER_ID:registry"];

const idl = ({ IDL }) => {
  const KeyStatus = IDL.Variant({ active: IDL.Null, retired: IDL.Null, compromised: IDL.Null });
  const IssuerKey = IDL.Record({
    id: IDL.Nat, publicKey: IDL.Vec(IDL.Nat8), status: KeyStatus, addedAt: IDL.Nat,
  });
  const Status = IDL.Variant({ active: IDL.Null, revoked: IDL.Null });
  const Record_ = IDL.Record({
    status: Status, statusChangedAt: IDL.Nat,
    issuerKeyId: IDL.Nat, signature: IDL.Vec(IDL.Nat8),
  });
  const VerifyReply = IDL.Variant({
    unknown: IDL.Null,
    found: IDL.Record({ credential: Record_, issuerKey: IssuerKey }),
  });
  return IDL.Service({ verify: IDL.Func([IDL.Vec(IDL.Nat8)], [VerifyReply], []) });
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dayToDate = (days) => new Date(Number(days) * 86400000).toISOString().slice(0, 10);

let actor;
async function getActor() {
  if (actor) return actor;
  if (!canisterId) throw new Error("registry canister id missing from ic_env");
  const agent = await HttpAgent.create({ rootKey: env?.IC_ROOT_KEY });
  actor = Actor.createActor(idl, { agent, canisterId });
  return actor;
}

// Status is never colour alone — the dot always sits beside a text label.
function verdict(kind, _mark, title, detail) {
  return `<div class="verdict v-${kind}"><span class="dot" aria-hidden="true"></span>
    <div><h2>${esc(title)}</h2><p>${esc(detail)}</p></div></div>`;
}
const checkLine = (ok, text) =>
  `<li class="${ok ? "ok" : "no"}"><span class="mark" aria-hidden="true">${ok ? "\u2713" : "\u2715"}</span>` +
  `<span>${esc(text)}</span></li>`;

async function verify(doc) {
  const out = $("result");
  try {
    // Hash locally, in canonical form. A different field order or a stray
    // field changes the digest, so canonicalBytes refuses both.
    const digest = await digestOf(doc);
    const reply = await (await getActor()).verify(Array.from(digest));

    if ("unknown" in reply) {
      out.innerHTML = verdict("bad", "✗", "Not a known credential",
        "The registry holds no record for this digest. The document was either never issued, or it has been altered since issue.")
        + `<div class="card"><dl><dt>Digest</dt><dd><code>${toHex(digest)}</code></dd></dl></div>`;
      return;
    }

    const { credential, issuerKey } = reply.found;
    const pub = new Uint8Array(issuerKey.publicKey);
    const sig = new Uint8Array(credential.signature);

    // The cryptographic check. Everything else is presentation.
    const sigOk = await ed.verifyAsync(sig, digest, pub);
    const revoked = "revoked" in credential.status;
    const keyState = Object.keys(issuerKey.status)[0];
    const changed = dayToDate(credential.statusChangedAt);

    let head;
    if (!sigOk) {
      head = verdict("bad", "✗", "Signature does not match",
        "A record exists for this digest, but the signature does not verify against the issuer key. This document should not be relied upon.");
    } else if (revoked) {
      head = verdict("bad", "✗", "Revoked",
        `This credential was issued by a registered issuer and subsequently revoked on ${changed}.`);
    } else if (keyState === "compromised") {
      head = verdict("warn", "!", "Valid, but the issuer key is marked compromised",
        "The signature verifies and the credential is not revoked, but the issuing key has been marked compromised. Confirm with the issuing office before relying on it.");
    } else {
      head = verdict("ok", "✓", "Valid credential",
        "The signature verifies against a registered issuer key, and the credential has not been revoked.");
    }

    const row = (k, v) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`;
    out.innerHTML = head + `<div class="card">
      <dl class="detail">
        ${row("Holder", esc(doc.holder ?? "\u2014"))}
        ${row("Cohort", esc(doc.cohort ?? "\u2014"))}
        ${row("Role", esc(doc.role ?? "\u2014"))}
        ${row("Outcome", esc(doc.outcome ?? "\u2014"))}
        ${row("Issued on", esc(doc.issuedOn ?? "\u2014"))}
        ${row("Status", `${revoked ? "Revoked" : "Active"} since ${esc(changed)}`)}
        ${row("Issuer key", `Key ${issuerKey.id} \u2014 ${esc(keyState)}<br><span class="mono">${toHex(pub)}</span>`)}
        ${row("Digest", `<span class="mono">${toHex(digest)}</span>`)}
      </dl>
      <ul class="checks">
        ${checkLine(true, "Document hashed locally in canonical form")}
        ${checkLine(true, "The registry holds a record for this digest")}
        ${checkLine(sigOk, sigOk ? "Ed25519 signature verifies against the issuer key"
                                 : "Ed25519 signature does not verify")}
        ${checkLine(!revoked, revoked ? `Revoked on ${changed}` : "Not revoked")}
        ${checkLine(keyState !== "compromised", keyState === "compromised"
            ? "Issuer key is marked compromised" : `Issuer key is ${keyState}`)}
      </ul></div>`;
  } catch (e) {
    out.innerHTML = verdict("bad", "!", "Could not verify", e.message ?? String(e));
  }
}

// ---- entry points -------------------------------------------------------
// A credential link carries the document in the URL FRAGMENT. Browsers never
// send the fragment to the server, so the holder's name stays in the browser.
function docFromHash() {
  const raw = location.hash.replace(/^#/, "").trim();
  if (!raw) return null;
  try {
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(raw.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)),
    );
    return JSON.parse(json);
  } catch {
    return undefined; // present but unreadable — distinct from absent
  }
}

function showInput(show) {
  $("input").classList.toggle("hidden", !show);
}

async function verifyDoc(doc) {
  showInput(false);
  $("result").innerHTML = '<div class="waiting">Checking the registry\u2026</div>';
  await verify(doc);
}

async function run() {
  const fromLink = docFromHash();
  if (fromLink === undefined) {
    $("result").innerHTML = verdict("bad", "!", "Broken credential link",
      "The credential link is incomplete or damaged. Request it again, or supply the credential file below.");
    showInput(true);
    return;
  }
  if (fromLink) { await verifyDoc(fromLink); return; }
  showInput(true);
}

// paste fallback
$("go").addEventListener("click", async () => {
  let doc;
  try { doc = JSON.parse($("doc").value); }
  catch {
    $("result").innerHTML = verdict("bad", "!", "Could not verify", "The text supplied is not valid JSON.");
    return;
  }
  await verifyDoc(doc);
});

// file picker + drag and drop
const readFile = async (file) => {
  try { return JSON.parse(await file.text()); }
  catch {
    $("result").innerHTML = verdict("bad", "!", "Could not read that file",
      "The file is not a valid credential document.");
    return null;
  }
};
$("pick").addEventListener("click", () => $("file").click());
$("file").addEventListener("change", async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  const doc = await readFile(f); if (doc) await verifyDoc(doc);
});
const drop = $("drop");
["dragenter", "dragover"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) =>
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", async (e) => {
  const f = e.dataTransfer?.files?.[0]; if (!f) return;
  const doc = await readFile(f); if (doc) await verifyDoc(doc);
});

// re-verify if the user opens a different credential link in the same tab
addEventListener("hashchange", run);
run();
