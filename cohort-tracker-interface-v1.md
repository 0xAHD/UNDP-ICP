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

## 3. Phase 2 — `registry` additions — **[PROPOSED]**

Blocked on `claude/gba-credentials-v1-phase2-decisions.md`. Sketch only; the
record shape is **not** settled and must not be implemented from this file.

```candid
type Status = variant { active; revoked };

type Record = record {
  status          : Status;
  statusChangedAt : Date;       // a DATE, not a timestamp — §2 of the decisions doc
  issuerKeyId     : KeyId;
  signature       : blob;
};

type VerifyReply = record {
  record_      : opt Record;    // null = unknown digest
  certificate  : blob;          // subnet BLS certificate
  witness      : opt blob;      // Merkle proof, if per-digest certification is chosen
};

service : {
  // issuance — admin only, idempotent per digest
  issue        : (digest : blob) -> (variant { ok; err : IssueError });
  revoke       : (digest : blob) -> (variant { ok; err : RevokeError });

  // the public entry point — CERTIFIED
  verify       : (digest : blob) -> (VerifyReply) query;
  issuerKeys   : ()             -> (vec IssuerKey) query;   // certified, append-only
}
```

**[NEEDS INPUT]** `Date` representation, whether `Status` needs a third state,
whether `issuerKeyId` is exposed, and the certification granularity — all in
`-phase2-decisions.md` §2 and §5.

---

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

**[PROPOSED]** `verify` and `issuerKeys` are the exceptions: they must return a
subnet certificate the caller verifies against the IC root key. That is the
entire point of the rail — a verifier trusts the subnet signature, not us.
Proven viable in `spikes/FINDINGS.md`.

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
