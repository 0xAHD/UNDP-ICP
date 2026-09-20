# GBA credentials v1 — Phase 2 decisions

> ## ⚠ Proposals, not recovered decisions
>
> The original was never in this repo. **Nothing here is a recovery of a
> decision Ahmed previously made.** Every §
> is a proposal to accept, amend or reject. Phase 2 stays blocked until the
> ones marked **DECISION OWED** are signed off — implementing against a guessed
> record shape is exactly what the storage rule exists to prevent, and the
> on-chain shape is permanent once live.

**Tags:** **[RULE]** stated by Ahmed in the brief · **[VERIFIED]** proven this
session · **[PROPOSED]** my recommendation · **DECISION OWED** blocks Phase 2.

---

## 0. MVP decisions — **DECIDED 2026-09-20**

Ahmed: *"choose the easiest option for our MVP."* Taken as a decision, recorded
here. Each is the simplest option that is still **correct**; none silently
weakens a rule in `personal-data-on-chain.md`.

| § | Decision | Why it is the easiest |
|---|---|---|
| **2** | `Status = {#active; #revoked}`; `Date` = **days since Unix epoch** (`Nat`), computed by the canister; **keep** `issuerKeyId` | No calendar maths (`Time.now() / 86_400_000_000_000`), canister-authoritative so no admin can backdate |
| **3** | **Option C — issuer key off chain** | Removes threshold signing, the proxy, cycles and every `await`. **Keeps the OpenCloud engine as the target.** |
| **5** | **Update-call `verify`** for v1 | No Merkle tree, no `ic-certification`/`sha2`, no certification plumbing. Consensus makes it trustworthy |
| **6** | Mark a key compromised; **never** auto-invalidate its past signatures | A status change, no cascade logic |

### Why C rather than B (this reverses the earlier recommendation)

§3 previously recommended **B** (registry on mainnet, signing via `aaaaa-aa`).
That was written for a production rail. For an MVP the answer changes, and C is
both the easiest *and* the least permanent:

- **C is the only option that is cleanly upgradeable.** The issuer key is just
  data in the append-only key set, so moving to threshold signing later means
  *adding a new issuer key and signing with it*. Credentials issued under the
  old key stay verifiable. A and B bind the rail to an infrastructure choice; C
  does not. This is precisely what append-only issuer keys are for.
- **C keeps the stated target.** A needs a console proxy; B abandons the engine.
  C needs neither — with no threshold signing there is no cross-subnet
  cycle-bearing call, so the engine's constraints simply do not apply.
- **C removes every `await` from the canister**, which also removes the TOCTOU
  risk flagged in §7 and `../CLAUDE.md` §11. The MVP canister is fully
  synchronous.

**What C costs, stated plainly.** The issuer private key is held off chain, so
it *can* be exfiltrated in a way a threshold key cannot. Verifiers trust our key
management. The delta is smaller than it first looks — under A and B the admins
control the canister and the controllers control the admins — but it is real.

**Condition on this decision:** it is right if MVP credentials are a pilot. If
the MVP will issue credentials that must stay authoritative for years, revisit
§3 before the first issuance, because *that* is the moment the choice starts to
matter.

### What this means for the build

The canister **does not sign**. An off-chain issuer signs the digest and submits
`issue(digest, signature, issuerKeyId)`; the canister validates and stores. It
also does not *verify* signatures — there is no Ed25519 verifier in `mo:core`,
and verification belongs client-side anyway, against the issuer public key the
canister returns. So:

- no `lib/Signer.mo`, no `aaaaa-aa`, no cycles, no proxy
- no async, no reentrancy surface
- `verify` is an update call returning the record plus the issuer key

---

## 1. Scope

What `registry` gains in Phase 2:

- `lib/Signer.mo` — threshold Ed25519 signing
- append-only issuer keys, **certified**
- digest-keyed credential records with explicit revocation
- `verify` — the public, certified verification entry point

---

## 2. The on-chain record — **DECIDED, see §0**

**[RULE]** From the brief, the record is trimmed: **no `issuedAt`, no
`expiresAt`**, and **`statusChangedAt` is a date**, not a timestamp.

**[PROPOSED]** Reading the intent behind that trim: issuance time and expiry are
properties of the *document*, not of the chain, and a full timestamp is
needlessly identifying — in a small cohort, a second-resolution issuance time
can single a person out. A date is coarse enough to be safe and precise enough
to be useful.

**[PROPOSED]** Proposed shape:

```motoko
type Status = { #active; #revoked };

type Record = {
  status           : Status;
  statusChangedAt  : Date;      // YYYY-MM-DD, not a timestamp
  issuerKeyId      : KeyId;     // which issuer key signed
  signature        : Blob;      // threshold Ed25519 over the digest
};
// keyed by: digest : Blob
```

Deliberately absent, each for a reason:

| Not included | Why |
|---|---|
| `issuedAt` / `expiresAt` | **[RULE]** trimmed; v1 has no expiry (`-plan.md` §7) |
| participant ID | the digest *is* the key; adding an ID lets anyone link credentials to a person |
| cohort / role | would let anyone enumerate cohort membership from the chain |
| any `Text` | `personal-data-on-chain.md` §2 |

**Decisions owed:**

- **2a.** Is `Status` exactly `{#active; #revoked}`, or is a third state needed
  (`#suspended`, `#superseded`)? Adding a variant later is a compatible upgrade;
  removing one is not, so err toward fewer.
- **2b.** Is `Date` a `Nat` day-number, or `{year; month; day}`? The latter is
  self-describing on the public page; the former is smaller.
- **2c.** Does the verifier need to know *which* issuer key signed
  (`issuerKeyId` above), or is "some currently-valid issuer key" enough?
  Including it aids audit and key rotation; it also slightly narrows issuance
  timing.

---

## 3. Where the issuer key lives — **DECIDED: option C, see §0**

**[VERIFIED]** Cloud engines provide **no threshold signing**. On an engine the
call routes through the console proxy, and because `sign_with_schnorr` has no
`canister_id` field, the key is derived from **the proxy**, not from `registry`.
A different proxy yields different keys; **deleting a proxy destroys them.**

This collides with "the `registry` canister's principal IS the credential DID,
permanently". The identifier can still be `registry`'s principal — but the
**signing key behind it is anchored to the proxy.**

**Options:**

| | Approach | Cost |
|---|---|---|
| **A** | Accept the proxy as permanent infrastructure; record its id in version control and never delete or swap it | A console misclick invalidates every credential ever issued |
| **B** | Deploy `registry` to **mainnet** instead of the engine, so it signs via `aaaaa-aa` directly and the key is genuinely the registry's | Loses the engine's free-cycles model for this canister; signing costs 10B cycles each |
| **C** | Keep the issuer key **off chain**; put only digests and issuer-key fingerprints on chain | Simplest, but the rail stops being self-custodial — verifiers trust our key management |

**[PROPOSED]** **B**, for a credential rail specifically. The whole value
proposition is "you don't have to trust us" (`-plan.md` §2), and A makes a
deletable console resource a single point of permanent failure while C
reintroduces exactly the trust the rail is meant to remove. The cycles cost is
real but bounded and predictable.

**This is Ahmed's call.** It is the single most consequential open item, and it
cannot be walked back after the first credential is issued.

---

## 4. The four assumptions — **status**

**[NEEDS INPUT]** The brief says this document listed four unverified
assumptions to prove before building. **Their actual content is unknown here.**
Below are four *candidates* — the four things the design genuinely depends on —
marked with what the spikes settled. **Reconcile against the real list if it
surfaces.**

| # | Candidate assumption | Status |
|---|---|---|
| **1** | A query response can be cryptographically verified end to end by an untrusting client | **[VERIFIED]** BLS verified against root key; tampered values detected |
| **2** | Certified data survives canister upgrades without a `postupgrade` hook (which our persistence model forbids) | **[VERIFIED]** tested twice with distinct values; **confirm on mainnet** |
| **3** | Threshold Ed25519 is available and its signatures verify with stock off-chain tooling | **[VERIFIED]** 32-byte key, 64-byte sig, verifies in `node:crypto` |
| **4** | One certified root can cover *many* digests, so `verify` need not certify per record | **UNTESTED** — needs a Merkle tree (`ic-certification` + `sha2`); see §5 |

**[RULE]** Per the brief: if any assumption fails, ship an update-call `verify`
for v1 and document the upgrade path. On the evidence so far **that fallback is
not needed** — 1–3 hold. Assumption 4 is a performance/cost question, not a
correctness one: if it fails, `verify` still works, it just certifies a single
root that must be re-set on every write.

---

## 5. Certification granularity — **DECIDED: update-call verify, see §0**

**[VERIFIED]** Certifying one 32-byte value works and needs no Merkle library.

**[PROPOSED]** Two viable shapes:

- **Single root, re-certified on every write.** Simple, no extra dependency.
  Every issuance/revocation updates one root; `verify` returns the record plus
  the certificate. Requires the client to check the whole set, or requires
  trusting the canister to return the right record for the digest.
- **Merkle tree with per-digest witnesses.** A verifier proves *their* digest is
  in the tree without seeing the rest. Needs `ic-certification` + `sha2`.

**[PROPOSED]** The Merkle tree. Without per-digest witnesses, `verify` cannot
prove a *specific* record is the certified one, which weakens the guarantee to
"the canister told us" — the thing §4 of `-plan.md` is trying to eliminate.

**Decision owed:** accept the extra dependency, or accept the weaker guarantee
for v1 with the tree as a documented upgrade.

---

## 6. Issuer keys — **[PROPOSED]**

- **Append-only.** Keys are added, never removed. Removing a key would
  invalidate every credential it ever signed, handing a compromised admin a mass
  revocation primitive.
- Rotation = add a new key and stop signing with the old one; old signatures
  stay verifiable.
- A key carries a status so it can be marked *retired* (no new signatures) or
  *compromised* (a verifier should treat its signatures as suspect) — **without
  deleting it**.
- The issuer key set is **certified**, per §5.

**Decision owed:** whether a *compromised* key should invalidate its past
signatures. Security says yes; every honestly-issued credential it signed says
no. **[PROPOSED]** mark compromised, do not auto-invalidate, and revoke affected
records explicitly — so the decision is visible per credential rather than
silent and wholesale.

---

## 7. Security carried into implementation

**[VERIFIED]** From the review (`../CLAUDE.md` §11):

- `lib/Signer.mo` introduces the first `await` in this codebase. `requireAdmin`
  → `await sign(...)` → mutate state is a TOCTOU hole: re-check authorisation
  **after** the await, and use the CallerGuard pattern.
- Issuance must be **idempotent per digest** — a duplicate issuance is an
  adversarial test case in the gate, and a retry after a callback trap must not
  produce a second record.
- Admin methods reject the anonymous principal; refusals return `#err`, never
  trap.
- The two-admin floor binds admins, **not controllers**. Resolve the controller
  set before go-live (`-release-process.md`).
