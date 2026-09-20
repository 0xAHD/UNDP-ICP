# GBA credentials v1 — plan

**Status.** Authored 2026-09-20 to replace a missing original. This is a
**[PROPOSED]** design unless a line says otherwise. Tags as in
`personal-data-on-chain.md`.

**[NEEDS INPUT]** "GBA" is used throughout the brief without expansion. The
plan below is written from the rail's observable requirements; if GBA names a
specific external standard or programme with its own credential format, this
document must be reconciled with it before Phase 2 ships.

---

## 1. What the rail is for

**[RULE]** Two halves of one system:

- **`ops`** — internal accelerator operations. Not public.
- **`registry`** — a public credential rail. Its job is to let *anyone*, with no
  account and no trust in us, check that a credential we issued is genuine and
  still valid.

The public verification page is the product. Everything else serves it.

---

## 2. Actors

| Actor | Is | Trusts |
|---|---|---|
| **Issuer** | `registry` admins (two-key floor) | — |
| **Holder** | a cohort participant | holds their own credential document |
| **Verifier** | anyone with the public page | the IC subnet signature, not us |

**[PROPOSED]** The verifier is the design constraint. A verifier must be able to
check a credential **without** trusting our web server, our database, or our
good behaviour at verification time. That rules out "our API says it's valid"
and is the entire argument for certified queries (§5) and on-chain digests.

---

## 3. What is on chain vs not

**[RULE]** Per `personal-data-on-chain.md`: the credential **document** — which
names a person — never goes on chain. Only a **digest** of it does.

**[PROPOSED]** The flow:

1. The credential document is produced off chain and given to the holder.
   It contains a **random credential ID** supplying the entropy that makes its
   digest safe to publish (`personal-data-on-chain.md` §4).
2. Its digest is recorded on chain, keyed by that digest.
3. The issuer signs over the digest with a threshold key.
4. A verifier hashes the document they were shown, looks up the digest, and
   checks the signature and status.

A verifier learns nothing from the chain about anyone whose document they do not
already hold. Someone who holds a document can confirm it; nobody can enumerate
participants.

---

## 4. Trust model

**[PROPOSED]** A verifier's chain of trust:

```
IC subnet BLS key  →  certified query response   (no trust in our servers)
                   →  registry's issuerKeys      (which keys may issue)
                   →  signature over the digest  (this issuer signed it)
                   →  record status              (not revoked)
```

Two properties this must have:

- **Issuer keys are append-only.** A compromised admin must not be able to
  *remove* a key and thereby invalidate every credential it signed. Rotation is
  adding a new key, never deleting an old one.
- **Revocation is explicit and dated.** A credential is valid unless the chain
  says otherwise; the verifier must see revocation, not infer it from absence.

---

## 5. Why certified queries

**[VERIFIED]** A plain `query` is answered by a single replica that can lie. For
a rail whose only value is "you don't have to trust us", an uncertified
`verify` would be self-defeating.

**[VERIFIED]** The certified path works on this toolchain — BLS signature
verified against the root key, `certified_data` read from the verified tree,
tampered values detected, and certification survives a canister upgrade. See
`spikes/FINDINGS.md` and `gba-credentials-v1-phase2-decisions.md` §4.

---

## 6. Phases

| Phase | Scope | State |
|---|---|---|
| **0 — scaffold** | two canisters, migration chain, admin floor, dev loop | **done**, 34/34 adversarial cases per canister |
| **1 — feasibility** | establish the mechanisms the rail depends on | see `-phase1-results.md` |
| **2 — the rail** | signing, issuer keys, digest records, certified `verify` | blocked on `-phase2-decisions.md` |
| **3 — go-live** | second controller, engine/mainnet deploy, public page | gated, see `-release-process.md` |

---

## 7. Non-goals for v1

**[PROPOSED]** Stated so they do not creep in:

- No credential **expiry**. Trimmed from the on-chain record deliberately
  (`-phase2-decisions.md` §2); a credential is valid or revoked, nothing else.
- No **selective disclosure** / ZK predicates. Holders show the whole document.
- No **holder-held keys**. Participants are not asked to manage a wallet; the
  document plus the public page is the whole holder experience.
- No **on-chain participant enumeration**. There is deliberately no "list all
  credentials" method — see §3.
