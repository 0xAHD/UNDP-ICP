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

function verdict(kind, mark, title, detail) {
  return `<div class="verdict v-${kind}"><div class="mark">${mark}</div>
    <div><h2>${esc(title)}</h2><p>${esc(detail)}</p></div></div>`;
}
const checkLine = (ok, text) =>
  `<li class="${ok ? "pass" : "fail"}"><span>${ok ? "✓" : "✗"}</span><span>${esc(text)}</span></li>`;

async function verify() {
  const out = $("result");
  const status = $("status");
  out.innerHTML = "";
  status.textContent = "verifying…";
  $("go").disabled = true;
  try {
    let doc;
    try { doc = JSON.parse($("doc").value); }
    catch { throw new Error("That is not valid JSON."); }

    // Hash locally, in canonical form. A different field order or a stray
    // field changes the digest, so canonicalBytes refuses both.
    const digest = await digestOf(doc);
    const reply = await (await getActor()).verify(Array.from(digest));

    if ("unknown" in reply) {
      out.innerHTML = verdict("bad", "✗", "Not a known credential",
        "No record exists for this document. It was never issued, or it has been altered.")
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
        "A record exists, but the signature does not verify against the issuer key. Do not trust this document.");
    } else if (revoked) {
      head = verdict("bad", "✗", "Revoked",
        `This credential was genuinely issued but was revoked on ${changed}.`);
    } else if (keyState === "compromised") {
      head = verdict("warn", "!", "Valid, but the issuer key is marked compromised",
        "The signature checks out and the credential is not revoked, but its issuer key has been flagged. Treat with caution.");
    } else {
      head = verdict("ok", "✓", "Valid credential",
        "The signature verifies against a registered issuer key and the credential has not been revoked.");
    }

    out.innerHTML = head + `<div class="card">
      <dl>
        <dt>Holder</dt><dd>${esc(doc.holder ?? "—")}</dd>
        <dt>Cohort</dt><dd>${esc(doc.cohort ?? "—")}</dd>
        <dt>Role</dt><dd>${esc(doc.role ?? "—")}</dd>
        <dt>Outcome</dt><dd>${esc(doc.outcome ?? "—")}</dd>
        <dt>Issued on</dt><dd>${esc(doc.issuedOn ?? "—")}</dd>
        <dt>Status</dt><dd>${revoked ? "revoked" : "active"} (since ${esc(changed)})</dd>
        <dt>Issuer key</dt><dd>#${issuerKey.id} — ${esc(keyState)}<br><code>${toHex(pub)}</code></dd>
        <dt>Digest</dt><dd><code>${toHex(digest)}</code></dd>
      </dl>
      <ul class="checks">
        ${checkLine(true, "Document hashed locally in canonical form")}
        ${checkLine(true, "Registry holds a record for this digest")}
        ${checkLine(sigOk, sigOk ? "Ed25519 signature verifies against the issuer key"
                                 : "Ed25519 signature does NOT verify")}
        ${checkLine(!revoked, revoked ? `Revoked on ${changed}` : "Not revoked")}
        ${checkLine(keyState !== "compromised", keyState === "compromised"
            ? "Issuer key is marked COMPROMISED" : `Issuer key is ${keyState}`)}
      </ul></div>`;
  } catch (e) {
    out.innerHTML = verdict("bad", "!", "Could not verify", e.message ?? String(e));
  } finally {
    status.textContent = "";
    $("go").disabled = false;
  }
}

$("go").addEventListener("click", verify);
$("sample").addEventListener("click", async () => {
  const r = await fetch("./example-credential.json").catch(() => null);
  if (r?.ok) $("doc").value = JSON.stringify(await r.json(), null, 2);
  else $("status").textContent = "no example available";
});
