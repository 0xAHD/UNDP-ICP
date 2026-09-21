// Ops console — cohorts, completion rules and credential status.
//
// Admin actions are authenticated with Internet Identity. The canisters do the
// real authorisation: every mutating method checks the caller against the admin
// set and rejects the anonymous principal. This console only decides what to
// SHOW — it is a convenience, never a security boundary.
//
// Issuing is deliberately absent. It needs the issuer private key, which is
// held off chain by the issuer tool and must never reach a browser. Revocation
// needs no key, so it is here.
import { AuthClient } from "@icp-sdk/auth/client";
import { HttpAgent, Actor } from "@icp-sdk/core/agent";
import { safeGetCanisterEnv } from "@icp-sdk/core/agent/canister-env";
import { IDL } from "@icp-sdk/core/candid";

// Root key and canister ids come from the ic_env cookie the asset canister
// sets. Never fetchRootKey(): it trusts whatever the replica returns.
const env = safeGetCanisterEnv();
const OPS = env?.["PUBLIC_CANISTER_ID:ops"];
const REGISTRY = env?.["PUBLIC_CANISTER_ID:registry"];

// ---- Candid ---------------------------------------------------------------
const opsIdl = ({ IDL }) => {
  const CohortStatus = IDL.Variant({ open: IDL.Null, closed: IDL.Null });
  const Cohort = IDL.Record({
    id: IDL.Text, status: CohortStatus, openedAt: IDL.Nat, closedAt: IDL.Opt(IDL.Nat),
  });
  const Rule = IDL.Record({
    role: IDL.Text, requiredMilestones: IDL.Vec(IDL.Text), setAt: IDL.Nat,
  });
  const CohortError = IDL.Variant({
    anonymousCaller: IDL.Null, notAuthorized: IDL.Null, invalidIdentifier: IDL.Null,
    duplicateCohort: IDL.Null, unknownCohort: IDL.Null, cohortClosed: IDL.Null,
    alreadyClosed: IDL.Null,
  });
  const RuleError = IDL.Variant({
    anonymousCaller: IDL.Null, notAuthorized: IDL.Null, invalidIdentifier: IDL.Null,
    unknownCohort: IDL.Null, cohortClosed: IDL.Null,
    tooManyMilestones: IDL.Null, duplicateMilestone: IDL.Null,
  });
  return IDL.Service({
    listCohorts: IDL.Func([], [IDL.Vec(Cohort)], ["query"]),
    completionRules: IDL.Func([IDL.Text], [IDL.Vec(Rule)], ["query"]),
    callerIsAdmin: IDL.Func([], [IDL.Bool], ["query"]),
    openCohort: IDL.Func([IDL.Text], [IDL.Variant({ ok: IDL.Null, err: CohortError })], []),
    closeCohort: IDL.Func([IDL.Text], [IDL.Variant({ ok: IDL.Null, err: CohortError })], []),
    setCompletionRule: IDL.Func(
      [IDL.Text, IDL.Text, IDL.Vec(IDL.Text)],
      [IDL.Variant({ ok: IDL.Null, err: RuleError })], []),
  });
};

const registryIdl = ({ IDL }) => {
  const KeyStatus = IDL.Variant({ active: IDL.Null, retired: IDL.Null, compromised: IDL.Null });
  const IssuerKey = IDL.Record({
    id: IDL.Nat, publicKey: IDL.Vec(IDL.Nat8), status: KeyStatus, addedAt: IDL.Nat,
  });
  const Status = IDL.Variant({ active: IDL.Null, revoked: IDL.Null });
  const Cred = IDL.Record({
    status: Status, statusChangedAt: IDL.Nat, issuerKeyId: IDL.Nat, signature: IDL.Vec(IDL.Nat8),
  });
  const VerifyReply = IDL.Variant({
    unknown: IDL.Null,
    found: IDL.Record({ credential: Cred, issuerKey: IssuerKey }),
  });
  const RevokeError = IDL.Variant({
    anonymousCaller: IDL.Null, notAuthorized: IDL.Null,
    unknownDigest: IDL.Null, alreadyRevoked: IDL.Null,
  });
  return IDL.Service({
    callerIsAdmin: IDL.Func([], [IDL.Bool], ["query"]),
    issuerKeys: IDL.Func([], [IDL.Vec(IssuerKey)], ["query"]),
    verify: IDL.Func([IDL.Vec(IDL.Nat8)], [VerifyReply], []),
    revoke: IDL.Func([IDL.Vec(IDL.Nat8)], [IDL.Variant({ ok: IDL.Null, err: RevokeError })], []),
  });
};

// ---- helpers --------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dayToDate = (d) => new Date(Number(d) * 86400000).toISOString().slice(0, 10);
const toHex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (h) => {
  const clean = h.trim().toLowerCase().replace(/\s+/g, "");
  if (!/^[0-9a-f]*$/.test(clean) || clean.length % 2) return null;
  return new Uint8Array(clean.match(/../g)?.map((x) => parseInt(x, 16)) ?? []);
};
// Retiring a key is routine; only `compromised` is a fault. Colouring them
// alike would have an operator reading an ordinary rotation as an incident.
const keyStatusClass = (s) =>
  "active" in s ? "active" : "compromised" in s ? "revoked" : "closed";
const say = (el, text, kind = "") => { $(el).innerHTML = `<div class="msg ${kind}">${esc(text)}</div>`; };
const clear = (el) => { $(el).innerHTML = ""; };

/// Turn a Candid error variant into something an operator can act on.
const errText = (e) => ({
  anonymousCaller: "You are not signed in.",
  notAuthorized: "Your principal is not an administrator of this canister.",
  invalidIdentifier: "Identifiers must be lowercase letters, digits and hyphens, up to 32 characters.",
  duplicateCohort: "That cohort already exists.",
  unknownCohort: "No such cohort.",
  cohortClosed: "That cohort is closed. Its rules are frozen permanently.",
  alreadyClosed: "That cohort is already closed.",
  tooManyMilestones: "Too many milestones for one rule.",
  duplicateMilestone: "The same milestone is listed twice.",
  unknownDigest: "The registry holds no record for that digest.",
  alreadyRevoked: "That credential is already revoked.",
}[Object.keys(e)[0]] ?? Object.keys(e)[0]);

// ---- state ----------------------------------------------------------------
// `ops` and `registry` keep SEPARATE admin sets, so a principal can govern one
// and not the other. Track both rather than letting one stand for the other.
let authClient, identity = null, ops = null, registry = null;
let isOpsAdmin = false, isRegistryAdmin = false;

async function actors(id) {
  const agent = await HttpAgent.create({
    ...(id ? { identity: id } : {}),
    rootKey: env?.IC_ROOT_KEY,
  });
  ops = Actor.createActor(opsIdl, { agent, canisterId: OPS });
  registry = Actor.createActor(registryIdl, { agent, canisterId: REGISTRY });
}

function renderIdentity() {
  const p = identity?.getPrincipal().toText();
  $("principal").textContent = p ?? "Not signed in";
  $("signin").classList.toggle("hidden", !!identity);
  $("signout").classList.toggle("hidden", !identity);
  const both = isOpsAdmin && isRegistryAdmin;
  const label = both ? "Administrator"
    : isOpsAdmin ? "Administrator \u2014 cohorts only"
    : isRegistryAdmin ? "Administrator \u2014 registry only"
    : "Not an administrator";
  $("adminState").innerHTML = !identity ? ""
    : `<span class="pill ${isOpsAdmin || isRegistryAdmin ? "is-admin" : "not-admin"}">` +
      `<span class="dot"></span>${label}</span>`;
  // Gate only the buttons the canister would reject anyway.
  for (const b of ["openCohort", "setRule"]) $(b).disabled = !isOpsAdmin;
  if (identity && !both) {
    say("authMsg",
      "This principal does not administer " +
      (isOpsAdmin || isRegistryAdmin ? "both canisters" : "either canister") +
      ". Send the principal above to an existing administrator to be added. " +
      "Read-only information is still shown.", "err");
  } else clear("authMsg");
}

// ---- rendering ------------------------------------------------------------
async function loadCohorts() {
  try {
    const list = await ops.listCohorts();
    if (!list.length) { $("cohorts").innerHTML = `<p class="empty">No cohorts yet.</p>`; return; }
    const rows = await Promise.all(list.map(async (c) => {
      const open = "open" in c.status;
      const rules = await ops.completionRules(c.id);
      const rulesText = rules.length
        ? rules.map((r) => `${esc(r.role)}: ${r.requiredMilestones.map(esc).join(", ")}`).join("<br>")
        : `<span class="empty" style="padding:0">No rules set</span>`;
      return `<tr>
        <td><strong>${esc(c.id)}</strong></td>
        <td><span class="status ${open ? "open" : "closed"}"><span class="dot"></span>${open ? "Open" : "Closed"}</span></td>
        <td>${esc(dayToDate(c.openedAt))}${c.closedAt.length ? ` &rarr; ${esc(dayToDate(c.closedAt[0]))}` : ""}</td>
        <td>${rulesText}</td>
        <td class="num">${open && isOpsAdmin
          ? `<button class="btn-danger btn-small" data-close="${esc(c.id)}">Close</button>`
          : ""}</td>
      </tr>`;
    }));
    $("cohorts").innerHTML = `<table>
      <thead><tr><th>Cohort</th><th>Status</th><th>Dates</th><th>Completion rules</th><th></th></tr></thead>
      <tbody>${rows.join("")}</tbody></table>`;
    for (const b of $("cohorts").querySelectorAll("[data-close]")) {
      b.addEventListener("click", () => closeCohort(b.dataset.close));
    }
  } catch (e) { $("cohorts").innerHTML = `<div class="msg err">${esc(e.message ?? e)}</div>`; }
}

async function loadIssuerKeys() {
  try {
    const keys = await registry.issuerKeys();
    $("issuerKeys").innerHTML = keys.length ? `<table>
      <thead><tr><th>Key</th><th>Status</th><th>Added</th><th>Public key</th></tr></thead>
      <tbody>${keys.map((k) => `<tr>
        <td class="num">${k.id}</td>
        <td><span class="status ${keyStatusClass(k.status)}"><span class="dot"></span>${esc(Object.keys(k.status)[0])}</span></td>
        <td>${esc(dayToDate(k.addedAt))}</td>
        <td><span class="mono">${toHex(new Uint8Array(k.publicKey))}</span></td>
      </tr>`).join("")}</tbody></table>`
      : `<p class="empty">No issuer keys registered yet.</p>`;
  } catch (e) { $("issuerKeys").innerHTML = `<div class="msg err">${esc(e.message ?? e)}</div>`; }
}

// ---- actions --------------------------------------------------------------
async function withResult(msgEl, fn, okText) {
  clear(msgEl);
  try {
    const r = await fn();
    if ("ok" in r) { say(msgEl, okText, "ok"); return true; }
    say(msgEl, errText(r.err), "err"); return false;
  } catch (e) { say(msgEl, e.message ?? String(e), "err"); return false; }
}

const openCohort = () => withResult("cohortMsg",
  () => ops.openCohort($("newCohort").value.trim()),
  "Cohort opened.").then((ok) => { if (ok) { $("newCohort").value = ""; loadCohorts(); } });

const closeCohort = (id) => withResult("cohortMsg",
  () => ops.closeCohort(id),
  `Cohort ${id} closed. Its completion rules are now frozen permanently.`)
  .then((ok) => { if (ok) loadCohorts(); });

const setRule = () => {
  const milestones = $("ruleMilestones").value.split(",").map((s) => s.trim()).filter(Boolean);
  return withResult("ruleMsg",
    () => ops.setCompletionRule($("ruleCohort").value.trim(), $("ruleRole").value.trim(), milestones),
    "Completion rule set.").then((ok) => { if (ok) loadCohorts(); });
};

async function lookup() {
  clear("credResult");
  const digest = fromHex($("digest").value);
  if (!digest || digest.length !== 32) {
    say("credResult", "A credential digest is 64 hexadecimal characters.", "err"); return;
  }
  try {
    const reply = await registry.verify(Array.from(digest));
    if ("unknown" in reply) {
      say("credResult", "The registry holds no record for that digest.", "err"); return;
    }
    const { credential, issuerKey } = reply.found;
    const revoked = "revoked" in credential.status;
    $("credResult").innerHTML = `<table>
      <thead><tr><th>Status</th><th>Since</th><th>Issuer key</th><th></th></tr></thead>
      <tbody><tr>
        <td><span class="status ${revoked ? "revoked" : "active"}"><span class="dot"></span>${revoked ? "Revoked" : "Active"}</span></td>
        <td>${esc(dayToDate(credential.statusChangedAt))}</td>
        <td class="num">${issuerKey.id}</td>
        <td class="num">${!revoked && isRegistryAdmin ? `<button id="revoke" class="btn-danger btn-small">Revoke</button>` : ""}</td>
      </tr></tbody></table>`;
    $("revoke")?.addEventListener("click", () => withResult("credResult",
      () => registry.revoke(Array.from(digest)),
      "Credential revoked. Verifiers will now see it as revoked.").then((ok) => { if (ok) lookup(); }));
  } catch (e) { say("credResult", e.message ?? String(e), "err"); }
}

// ---- sign in --------------------------------------------------------------
async function refresh() {
  await actors(identity);
  [isOpsAdmin, isRegistryAdmin] = identity
    ? await Promise.all([ops.callerIsAdmin(), registry.callerIsAdmin()])
    : [false, false];
  renderIdentity();
  await Promise.all([loadCohorts(), loadIssuerKeys()]);
}

async function signIn() {
  try {
    identity = await authClient.signIn();
    await refresh();
  } catch (e) {
    say("authMsg", `Sign-in failed: ${e.message ?? e}`, "err");
  }
}

async function signOut() {
  await authClient.signOut();
  identity = null; isOpsAdmin = false; isRegistryAdmin = false;
  await refresh();
}

// Mainnet Internet Identity is the default and works from a local replica too,
// so there is no environment branching here.
authClient = new AuthClient();
// isAuthenticated() is synchronous and reads the stored session. getIdentity()
// on a load with nothing to restore waits for a delegation to be minted, so an
// anonymous visitor would block on the identity provider for no reason.
identity = authClient.isAuthenticated()
  ? await authClient.getIdentity().catch(() => null)
  : null;

// Another tab signing in or out changes the session record, not this page.
authClient.subscribe(() => {
  const signedIn = authClient.isAuthenticated();
  if (signedIn === !!identity) return;
  (async () => {
    identity = signedIn ? await authClient.getIdentity().catch(() => null) : null;
    await refresh();
  })();
});

$("signin").addEventListener("click", signIn);
$("signout").addEventListener("click", signOut);
$("openCohort").addEventListener("click", openCohort);
$("setRule").addEventListener("click", setRule);
$("lookup").addEventListener("click", lookup);

await refresh();
