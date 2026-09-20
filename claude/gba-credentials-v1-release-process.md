# GBA credentials v1 — release process

**Status.** Authored 2026-09-20 to replace a missing original. **[VERIFIED]**
means the mechanism was exercised this session; **[PROPOSED]** needs sign-off.

The governing idea: **everything is changeable now, almost nothing is
changeable after go-live.** This document is about where that line falls and
how to cross it once.

---

## 1. Pre-live loop

**[VERIFIED]** One entry point (`../CLAUDE.md` §5):

```bash
./scripts/dev.sh reset    # wipe state, fresh install  <- after ANY stable-shape change
./scripts/dev.sh seed     # bootstrap admins to the floor
./scripts/dev.sh up       # upgrade in place, keeping state (compatible changes)
./scripts/dev.sh test     # reset + adversarial suite on both canisters
./scripts/dev.sh status   # canister IDs, schema versions, admin counts
./scripts/dev.sh down
```

**[VERIFIED]** `up` refuses a stable-incompatible change and names `reset` as
the fix. That refusal is the guard rail, not a bug.

**[VERIFIED]** Pre-live, keep **one** migration file and fold every schema
change into it, bumping `schema`. A short chain replays faster forever and
leaves nothing frozen by mistake. `schemaVersion()` reports what a running
canister is on.

---

## 2. What freezes at go-live

**[RULE]**

| Thing | Before | After |
|---|---|---|
| Canister IDs / the credential DID | `reset` recreates them freely | **permanent** — never reinstall or delete |
| Stable shape / migration chain | edit the one file, `reset` | **append-only**; migrate, never reset |
| Candid interface | change freely | breaking changes break live verifiers |
| Admin set | `reset` + `seed` | governed on-chain, floor enforced, bootstrap latched |
| Controllers | one local controller is fine | **second controller required** |
| Issuer keys | n/a | **append-only, never deleted** |
| Business constants | edit + `reset` | code change + upgrade |

**[VERIFIED]** Local `reset` **changes canister IDs** — observed this session.
Free now; catastrophic after go-live.

---

## 3. Release gate

**[RULE]** Nothing is deploy-ready until each has been **run** and its real
output reported. Never claim a build or test passed without running it.

- [ ] `mops check` clean, including `check-stable` against `deployed/*.most`
- [ ] `mops build` clean
- [ ] Adversarial suite green — anonymous caller, non-admin, **duplicate
      issuance, revoked, tampered, unknown digest**
- [ ] `canister-security` review *(done 2026-09-20 for the access-control
      spine; must be repeated for Phase 2 code)*
- [ ] Upgrade/migration test — state survives, chain does not re-run
- [ ] Candid diff reviewed against the committed `src/*/*.did`

**[VERIFIED]** Current status: check and build clean; 34/34 adversarial cases
per canister. The issuance/revocation/tamper cases arrive with Phase 2.

---

## 4. Go-live checklist

**[RULE]** In order. Items 1–3 are not engineering tasks.

1. **The §3 proxy/DID decision made** (`-phase2-decisions.md`). Permanent;
   cannot be walked back after the first credential is issued.
2. **Second controller in place.** Not merely key-loss insurance — a controller
   can upgrade past every admin rule, so the controller set is the real trust
   root of the rail and must be at least as strong as the admin floor it is
   meant to protect. Two-of-N, a governance canister, or blackholing.
3. **UNDP data-protection sign-off** on `personal-data-on-chain.md` §4 and §6.
4. Phase 2 implemented; the four assumptions in `-phase2-decisions.md` §4
   reconciled and resolved.
5. Full gate (§3) green.
6. Migration chain reviewed — **from here it is append-only.**
7. Deploy. State network + canister ID + identity before acting.
8. **Commit `.icp/data/` immediately.** It carries the canister-name → ID
   mapping, and for `registry` that ID is the credential DID.
9. Record the **proxy canister id** in version control if option A or the engine
   path was chosen — it is permanent infrastructure.

---

## 5. Versioning

**[PROPOSED]**

- **`schema`** — the stable shape. Bumped in the migration chain whenever
  actor state changes. Readable live via `schemaVersion()`.
- **Candid** — the committed `src/*/*.did` is the contract. Regenerate with
  `mops generate candid` and **review the diff** before release. Additive
  changes are safe; removing a method or narrowing a type breaks live verifiers.
- **[PROPOSED]** Bake `service:git:sha` into the wasm at engine deploy so a
  running canister can be traced to a commit.

---

## 6. Rollback

**[PROPOSED]** Be honest about what rollback can and cannot do.

**Can be rolled back:** canister *code*. Deploy the previous wasm, provided the
stable shape is compatible in that direction — which it usually is not, since
migrations only run forward. Assume a code rollback needs a forward migration
that restores the old behaviour.

**Cannot be rolled back, ever:**

- anything written to canister state — it is public and permanent
- a credential already issued and observed
- the canister ID / DID
- a derived signing key whose proxy was deleted

**[RULE]** Therefore the release gate is preventive, not corrective. There is no
"fix it in the next release" for a personal-data leak or a wrong record shape.

---

## 7. Incident handling

**[PROPOSED]**

- **Compromised issuer key** — mark it compromised (never delete: that would
  invalidate every credential it signed) and explicitly revoke affected records.
  See `-phase2-decisions.md` §6.
- **Compromised admin** — remaining admins remove them; the floor prevents the
  set dropping below two. If the floor blocks it, add a replacement first.
- **Personal data written on chain** — it cannot be removed. Treat as a
  reportable data incident, notify UNDP data protection, and change the model so
  it cannot recur. Prevention is the only control (§6).
- **Lost admin keys (both)** — recovery is controller-only, via upgrade. Another
  reason item 2 of §4 matters.
