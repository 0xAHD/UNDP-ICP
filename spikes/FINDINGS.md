# Spike findings — 2026-09-20

Two throwaway spikes, run against a **local replica** (icp 1.5.0, network
launcher v16.0.0 / PocketIC, moc 1.16.1, core 2.6.2). They bake in no schema
and are not part of the product. Reproduce with `./run.sh`.

**Headline:** both mechanisms work locally — but the engine cannot do threshold
signing at all, and that changes what "the registry's principal is the
credential DID" can mean. See Finding 2; it needs a decision before go-live.

---

## Spike 1 — threshold Ed25519 signing

### 1. It works on a local replica — PASS

`aaaaa-aa` `schnorr_public_key` / `sign_with_schnorr` with `algorithm = #ed25519`:

| | |
|---|---|
| Key names available locally | `dfx_test_key`, `key_1`, `test_key_1` |
| Public key | 32 bytes, `schnorr_public_key` is **free** |
| Signature | 64 bytes |
| Signing fee | **10_000_000_000 cycles** (replica states it exactly; 0 is rejected) |

The replica enumerates every key it has when you ask for one it doesn't:

```
Requested unknown threshold key: schnorr:Ed25519:insecure_test_key_1, existing keys:
[ecdsa:Secp256k1:dfx_test_key, ecdsa:Secp256k1:key_1, ecdsa:Secp256k1:test_key_1,
 schnorr:Bip340Secp256k1:dfx_test_key, ..., schnorr:Ed25519:dfx_test_key,
 schnorr:Ed25519:key_1, schnorr:Ed25519:test_key_1,
 vetkd:Bls12_381_G2:dfx_test_key, ...]
```

Signatures verify off-chain with stock Ed25519 (`node:crypto`), and a tampered
message is rejected:

```
pubkey bytes : 32
sig bytes    : 64
VERIFIES     : true
tampered msg : false (must be false)
```

So `lib/Signer.mo` calling `aaaaa-aa` **is** locally testable, as the brief
assumed. Good news, and it de-risks Phase 2 development.

### 2. The engine cannot do this at all — DECISION NEEDED

Per the `cloud-engine-canisters` skill: **"cloud engines do not provide
threshold signing at all"**. An engine canister must reach mainnet's signing
through the **console proxy canister**.

The proxy inserts the calling canister's principal as `derivation_path[0]`, so
callers are isolated from each other. But `sign_with_schnorr` has no
`canister_id` field — **the key is always the caller's, and behind the proxy the
caller is the proxy**. Therefore:

- The issuer signing key is anchored to **(proxy canister id) + [registry principal, …]**.
- Point the app at a different proxy and **every derived key changes**. The old
  key is not recoverable from the new proxy.
- **Deleting a proxy destroys its keys permanently.**
- A self-deployed proxy does no isolation at all, so it derives differently
  again — the two kinds are not substitutes.

**Consequence for this project.** "The `registry` canister's principal IS the
credential DID, permanently" holds for the DID as an *identifier*, but the
**signing key behind it is anchored to the proxy, not to `registry`**. The proxy
becomes permanent infrastructure, as load-bearing as the canister itself — and
it is deletable from a console UI.

Options, for Ahmed to decide (all need `phase2-decisions` to confirm against):

1. **Accept the proxy as permanent infrastructure.** Document its id as part of
   the credential rail; never delete or swap it. Simplest, but a console
   misclick invalidates every credential ever issued.
2. **Deploy `registry` to mainnet rather than the engine**, so it signs via
   `aaaaa-aa` directly and the key is genuinely the registry's. Loses the engine's
   free-cycles model for this canister.
3. **Do not use threshold signing for the issuer key.** Hold the issuer key
   off-chain and put only digests + issuer-key fingerprints on-chain. Changes
   the trust model — the rail stops being self-custodial.

This is the single most consequential open item found, and it is cheap to get
wrong permanently.

---

## Spike 2 — certified queries

### 3. The full certified-query path works — PASS

`CertifiedData.set` (update) → `getCertificate` (query) → client verifies the
BLS signature against the replica root key → `certified_data` read out of the
**verified** state tree → compared against the served value:

```
certificate     : 1207 bytes
rootKey         : 133 bytes
lookup status   : Found
BLS signature   : VERIFIED
certified_data  : aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899
cert has /time  : yes
MATCHES CLAIM   : true
```

`/time` is present, so client-side freshness checking is available.

**Negative control passes.** A method that changes the served value *without*
re-certifying — exactly what a malicious replica would do — is detected:

```
claimed value   : deadbeefdeadbeef…
certified_data  : aabbccddeeff0011…
MATCHES CLAIM   : false
```

### 4. Certified data SURVIVES a canister upgrade — contradicts the skill

The `certified-variables` skill's pitfall 7 says certified data is cleared on
upgrade and must be re-set in a `postupgrade` hook. That is a real problem for
us, because enhanced orthogonal persistence **forbids** `system func postupgrade`.

**Tested, twice, with distinct values: certification survived the upgrade
intact.** Certify → verify (match) → upgrade → verify (still matches, same
bytes). So there is no re-certification dance to design around, and no conflict
with our persistence model.

Caveats: this is a local replica (PocketIC); confirm on mainnet before relying
on it. The skill's pitfall is written around Rust's explicit
`#[init]`/`#[post_upgrade]`, which may be why it does not bite here.

### 5. Single-value certification needs no Merkle library

Certifying one 32-byte root needs no tree, which sidesteps `ic-certification`
and `sha2` entirely. If `issuerKeys` is certified as a single hash over the key
set, that is enough.

**Per-digest witnesses are a different matter**: proving one digest without
shipping all of them needs a real Merkle tree, i.e. `ic-certification` + `sha2`
from the mops registry. Not attempted here.

### 6. Verdict for `verify`

The substrate holds: **a certified-query `verify` is viable for v1 on this
toolchain.** There is no substrate-level reason to fall back to an update call.

Not yet established, and still blocked on the missing
`gba-credentials-v1-phase2-decisions.md`:

- the **four specific assumptions** that document lists — unknown to us, untested;
- per-digest witness generation (needs the Merkle library above);
- whether a certificate must cover each digest individually or a periodic root
  suffices — a design choice with real latency/cost consequences.

---

## Toolchain gotchas found

- `Certificate.create` takes a **tagged** principal:
  `{ principal: { canisterId: Principal } }`, not a bare `Principal`. Passing a
  bare one throws a bare `Error: unreachable` whose stack points at the error's
  *construction* site, not the throw — badly misleading.
- `@dfinity/agent` / `@dfinity/principal` / `@dfinity/candid` are deprecated in
  favour of `@icp-sdk/core/*`.
- Management-canister types can be declared inline in Motoko, avoiding a
  dependency on `mo:ic` (which the blocked mops registry would otherwise gate).
