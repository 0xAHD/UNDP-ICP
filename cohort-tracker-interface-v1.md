# Cohort Tracker — interface v1

**Status.** Authored 2026-09-20 to replace a missing original. **[VERIFIED]**
is implemented and tested today; **[PROPOSED]** is a Phase 2 sketch needing
sign-off; **[NEEDS INPUT]** is gated on a decision.

The authoritative machine-readable contract is the committed Candid:
`src/registry/registry.did` and `src/ops/ops.did`. Where this document and those
files disagree, **the `.did` files win** — regenerate with
`mops generate candid` and review the diff.

---

## 1. Shape

```
registry   public credential rail      principal = the credential DID
ops        internal accelerator ops    not public
```

Both share an access-control spine (`src/shared/`). Neither currently stores any
participant data.

---

## 2. Implemented today — **[VERIFIED]**

Identical on both canisters. Every mutating method rejects the anonymous
principal and returns typed `#err` rather than trapping.

```candid
type AccessError = variant {
  adminFloor;        // removal would drop below the floor
  alreadyAdmin;      // target is already an admin
  anonymousCaller;   // the CALLER is anonymous
  anonymousTarget;   // the anonymous principal was offered as a TARGET
  bootstrapClosed;   // the bootstrap latch is shut, permanently
  notAuthorized;     // authenticated but not an admin (or not a controller)
  unknownAdmin;      // target is not an admin
};
type Result = variant { ok; err : AccessError };

service : {
  // governance — admin only
  addAdmin        : (who : principal) -> (Result);
  removeAdmin     : (who : principal) -> (Result);
  // seeding — controller only, until the latch closes
  bootstrapAdmin  : (who : principal) -> (Result);

  // introspection — all uncertified queries, see §5
  listAdmins      : () -> (vec principal) query;
  adminCount      : () -> (nat)           query;
  adminFloor      : () -> (nat)           query;
  bootstrapClosed : () -> (bool)          query;
  callerIsAdmin   : () -> (bool)          query;
  schemaVersion   : () -> (nat)           query;
}
```

**Admin model.** The set starts empty. A **controller** seeds it via
`bootstrapAdmin` until the floor (2 for `registry`) is reached, which sets a
**stable latch** that is never cleared — so bootstrap stays shut even if the
floor is later raised. From then on admins govern each other.

**[VERIFIED]** 34 adversarial cases per canister, all passing.

---

## 3. `registry` credential rail — **[VERIFIED]** built 2026-09-20

MVP per `claude/gba-credentials-v1-phase2-decisions.md` §0. The issuer private
key is **off chain**: the canister never signs and never verifies signatures.
An off-chain issuer signs the digest and submits it; a verifier checks the
signature client-side against the issuer key the canister returns.

Consequences: no `Signer.mo`, no threshold signing, no proxy, no cycles, and
**no `await` anywhere in the canister** — so no TOCTOU or reentrancy surface.

```candid
type KeyId = nat;
type Date  = nat;                         // days since the Unix epoch
type KeyStatus  = variant { active; retired; compromised };
type IssuerKey  = record { id : KeyId; publicKey : blob;
                           status : KeyStatus; addedAt : Date };
type Status     = variant { active; revoked };
type Record     = record { status : Status; statusChangedAt : Date;
                           issuerKeyId : KeyId; signature : blob };
type VerifyReply = variant {
  unknown;                                // a valid answer, not an error
  found : record { credential : Record; issuerKey : IssuerKey };
};

service : {
  // admin only
  addIssuerKey       : (publicKey : blob) -> (Result_4);        // append-only
  setIssuerKeyStatus : (id : KeyId, status : KeyStatus) -> (Result);
  issue              : (digest : blob, issuerKeyId : KeyId,
                        signature : blob) -> (Result_3);        // idempotent
  revoke             : (digest : blob) -> (Result_1);

  // public — anonymous callers allowed, by design
  verify             : (digest : blob) -> (VerifyReply);        // UPDATE call
  issuerKeys         : () -> (vec IssuerKey) query;
  issuerKeyCount     : () -> (nat) query;
  credentialCount    : () -> (nat) query;
}
```

**Why `verify` is an update call.** A query is answered by one replica that
could lie; an update goes through consensus, so it is trustworthy with no
certification plumbing (decisions §5). Certified queries were proven viable
(`spikes/FINDINGS.md`) — the upgrade is a drop-in, the record shape does not
change.

**Validation enforced on issuance:** digest exactly 32 bytes, signature exactly
64 bytes, issuer key must exist and be `#active`, and the digest must not
already have a record (**duplicate issuance is refused, never overwritten** —
silently overwriting would let an admin swap the signature on an issued
credential).

**There is deliberately no method to list digests.** `credentialCount` returns a
count only, so cohort membership cannot be harvested from the chain.

**[VERIFIED]** 28-case end-to-end flow with a real Ed25519 keypair: admin-only
issuance, duplicate refusal, client-side signature verification, tampered-digest
rejection, unknown digest, revocation visible to verifiers, retired keys unable
to issue but still verifying old credentials.

## 4. `ops` — **[NEEDS INPUT]**

Deliberately empty beyond governance. The participant/cohort/milestone model is
gated on three decisions that are not engineering calls
(`../CLAUDE.md` §7): the funding-note storage basis, which off-chain store holds
participant names, and the per-role completion-rule values.

**[RULE]** Whatever lands here, on-chain fields stay categorical: opaque ID,
role, cohort, status, digests. Names, emails, evidence URLs and funding figures
live off chain. See `claude/personal-data-on-chain.md`.

---

## 5. Trust properties of this interface

**[VERIFIED]** **Every query listed in §2 is uncertified** — answered by a single
replica that could lie. They are fine for UI display. **No verifier and no other
canister may make a trust decision on them.**

**[VERIFIED]** `verify` is the exception, and it earns its trust differently in
the MVP: it is an **update call**, so it goes through consensus rather than a
single replica. That is trustworthy without certification plumbing.

**[VERIFIED]** `issuerKeys` is still a plain query and therefore uncertified.
For the MVP a verifier should treat the issuer key returned *inside the `verify`
reply* as authoritative — it came through consensus — and use `issuerKeys` only
for display. Certifying the key set is the v2 upgrade (decisions §5).

**[RULE]** Never call `fetchRootKey()` in production client code. Read the root
key from the `ic_env` cookie (`IC_ROOT_KEY`) and pass it to `HttpAgent.create()`,
so the same code works locally and on mainnet with no environment branching.

---

## 6. The public verification page — **[PROPOSED]**

Not built. Requirements it must meet:

1. Hash the document the holder presents, client-side.
2. Call `verify(digest)`.
3. **Verify the certificate against the IC root key in the browser** — not
   server-side, or the trust model collapses back to trusting our server.
4. Check the certificate's `/time` for freshness, so a stale certificate cannot
   be replayed.
5. Check the signature against a key in the certified `issuerKeys` set.
6. Show one of: **valid** / **revoked** (with `statusChangedAt`) / **unknown
   digest**.

**[NEEDS INPUT]** The canonical document serialisation — exactly which bytes are
hashed. Without it two verifiers can hash the same document differently and
disagree. Flagged in `-phase1-results.md` §4.
