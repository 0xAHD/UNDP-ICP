# GBA credentials v1 — Phase 1 results

> ## ⚠ This is not a recovery of the original
>
> The original `-phase1-results.md` was never in this repo and its contents are
> unknown here. **Nothing in it has been reconstructed, guessed, or inferred.**
>
> What follows is a record of feasibility work **actually run on 2026-09-20**,
> with real output. If a prior Phase 1 exists elsewhere — in another repo, a
> console, or Ahmed's notes — its findings are **still missing** and §4 below
> lists what they would need to cover. Do not treat this file as complete until
> that gap is closed or Ahmed confirms there was no prior Phase 1.

**Status tags:** **[VERIFIED]** run this session, output in `spikes/FINDINGS.md`
· **[NEEDS INPUT]** only Ahmed can supply.

---

## 1. What was run

Two throwaway spikes under `spikes/`, against a local replica (icp 1.5.0,
launcher v16.0.0 / PocketIC, moc 1.16.1, core 2.6.2). Reproduce with
`spikes/run.sh`. They bake in no schema and are not part of the product.

---

## 2. Result — threshold Ed25519 signing: **works locally**

**[VERIFIED]**

| Property | Value |
|---|---|
| Key names available | `dfx_test_key`, `key_1`, `test_key_1` |
| Public key | 32 bytes, `schnorr_public_key` is free |
| Signature | 64 bytes |
| Fee | `10_000_000_000` cycles; 0 is rejected with the exact requirement |

Signatures verify off-chain with stock Ed25519 (`node:crypto`), and a tampered
message is rejected:

```
pubkey bytes : 32
sig bytes    : 64
VERIFIES     : true
tampered msg : false (must be false)
```

**Consequence:** `lib/Signer.mo` calling `aaaaa-aa` is locally testable, so
Phase 2 is developable without an engine.

**[VERIFIED]** **But the engine cannot do this at all.** Cloud engines provide
no threshold signing; the call must go through the console proxy to mainnet, and
the derived key is anchored to the **proxy**, not to `registry`. Full analysis
in `opencloud-engine-deployment.md` §4; the decision it forces is
`-phase2-decisions.md` §3.

---

## 3. Result — certified queries: **work, and survive upgrades**

**[VERIFIED]** Full path: `CertifiedData.set` (update) → `getCertificate`
(query) → client verifies the BLS signature against the replica root key →
`certified_data` read from the **verified** tree → compared to the served value.

```
certificate     : 1207 bytes
BLS signature   : VERIFIED
certified_data  : aabbccddeeff00112233445566778899…
cert has /time  : yes
MATCHES CLAIM   : true
```

- `/time` is present, so client-side freshness checking is available.
- **Negative control passes.** Serving a value that was never certified — what a
  malicious replica would do — is detected: `MATCHES CLAIM : false`.
- **Certification survives a canister upgrade**, tested twice with distinct
  values. This contradicts the `certified-variables` skill's pitfall 7 (re-set
  certified data in `postupgrade`), which matters because our persistence model
  forbids that hook. **Confirm on mainnet before relying on it** — this was a
  local replica.
- Single-value certification needs **no** Merkle library. Per-digest witnesses
  would need `ic-certification` + `sha2`.

---

## 4. Still missing — what a prior Phase 1 would need to cover

**[NEEDS INPUT]** The spikes above establish *mechanism feasibility*. They do
not answer the programme-level questions a Phase 1 normally settles, and none of
these can be answered from this repo:

1. ~~**The credential document format.**~~ **DEFINED 2026-09-20** —
   `shared-js/credential.mjs` is the single source of truth, used by both the
   issuer and the verification page so they cannot drift. Compact JSON, keys in
   a fixed `FIELD_ORDER`, no whitespace, UTF-8, SHA-256. Unknown fields are
   refused rather than silently dropped (a dropped field would not be covered by
   the digest). **[PROPOSED]** — still needs sign-off, and must be reconciled if
   GBA prescribes a format.
2. **Who the issuers are** in practice, and how their keys are held.
3. **The revocation policy** — who may revoke, on what grounds, and what a
   verifier should show when they see a revoked credential.
4. **Whether GBA is an external standard** with a prescribed credential format
   (see `-plan.md` header). If so, §1–3 above may be constrained by it.
5. **The four assumptions** the brief says this phase left unverified. Their
   actual content is unknown here; `-phase2-decisions.md` §4 proposes four
   candidates and marks which the spikes already settled, but that is a
   proposal, **not** a recovery of the originals.

---

## 5. Verdict

**[VERIFIED]** Both mechanisms the rail depends on are proven on a local
replica. No substrate-level reason to fall back to an update-call `verify`.

**[NEEDS INPUT]** Phase 2 remains blocked — not on feasibility, but on the
record shape and the decisions in `-phase2-decisions.md`.
