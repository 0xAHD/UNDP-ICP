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

## 1. Scope

What `registry` gains in Phase 2:

- `lib/Signer.mo` — threshold Ed25519 signing
- append-only issuer keys, **certified**
- digest-keyed credential records with explicit revocation
- `verify` — the public, certified verification entry point

---

## 2. The on-chain record — **DECISION OWED**

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

## 3. Where the issuer key lives — **DECISION OWED, and permanent**

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

## 5. Certification granularity — **DECISION OWED**

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
