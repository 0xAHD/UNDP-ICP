# Cohort Tracker — working rules

UNDP AltFinLab "Cohort Tracker": an internal accelerator-ops app (`ops`) plus a
public credential-verification rail (`registry`). RAW ICP track — our own
`icp.yaml`, our own identity, canisters we control, targeting the OpenCloud
cloud engine. **Treat everything here as production-adjacent.**

---

## 1. Storage rule — binding

**On-chain state is PUBLIC and PERMANENT.** Anything written to canister state
can be read by anyone, forever, and cannot be redacted.

**Never put in canister state, in any canister:**
- names, emails, phone numbers, or any direct identifier
- free text of any kind (notes, comments, descriptions, justifications)
- evidence URLs or document links
- financial data (amounts, funding notes, bank details)

**Only ever store:** opaque/pseudonymous IDs, role, cohort, status, categorical
enums, and cryptographic digests.

Participant-identifying data lives in an **off-chain store**. Which store is
still an open decision (§6).

If a proposed model drifts toward any of the above — **stop and flag it**, even
if it was asked for. A field that "seems fine" is the failure mode this rule
exists to prevent.

---

## 2. The registry canister is a permanent identity

**The `registry` canister's principal IS the credential DID, permanently.**

- **NEVER** `reinstall` or `delete` the registry canister.
- `icp deploy --mode reinstall` wipes state and is forbidden for `registry`.
- Commit `.icp/data/`. It holds `mappings/<environment>.ids.json`, the
  canister-name → canister-ID map. Losing it loses the DID mapping.
  - `.icp/cache/` is ephemeral and **is** gitignored.
  - Note: a *managed local* network keeps its IDs in `.icp/cache/`, so
    `.icp/data/` only appears once a connected environment (engine/mainnet) is
    deployed. Do not "clean up" `.icp/` because it looks empty locally.

---

## 3. Irreversible actions need per-action confirmation

Before any of: `reinstall`, `delete`, `stop`, controller change, or cycle
withdrawal — get explicit confirmation from Ahmed **naming the canister and the
effect**. One approval covers one action; it does not carry to the next.

**Always state network + canister ID + identity before acting.**

---

## 4. Deploy gate

**LOCAL REPLICA ONLY** at this phase.

- Do **not** deploy to the OpenCloud engine or to mainnet. That is a separate,
  separately-confirmed step, gated on a **second controller** being in place.
  (The local deploy currently has a single controller — exactly the single-key
  loss risk the engine deploy must not ship with.)
- `icp.yaml` deliberately defines **no** engine/mainnet environment yet.
- Local work uses throwaway identities. The `ahmed-opencloud` identity is
  **engine-only** — do not use it locally.

---

## 5. Iterating before go-live

**Everything here is changeable right now. Almost none of it is changeable
after go-live.** Knowing which is which is the whole game.

### The loop

```bash
./scripts/dev.sh reset    # wipe local state, fresh install  <- after ANY stable-shape change
./scripts/dev.sh seed     # bootstrap admins up to the floor
./scripts/dev.sh up       # upgrade in place, keeping state  <- compatible changes only
./scripts/dev.sh test     # reset + full adversarial suite on both canisters
./scripts/dev.sh status   # canister IDs, schema versions, admin counts
./scripts/dev.sh down     # stop the local network
```

`up` refuses an incompatible change and tells you to `reset` — that refusal is
the guard rail, not a bug. Local resets **recreate canisters and change their
IDs**; that is free now and catastrophic after go-live (§2).

### Migration chain: collapse now, stack later

**Pre-live:** keep ONE migration file and fold every schema change into it.
Bump `schema` in that file when the stable shape changes, then `reset`. A short
chain replays faster forever and leaves nothing frozen by mistake.

**At go-live:** `migrations/20260920_000000.mo` freezes permanently. From then
on, never edit or rename it — every change gets a NEW timestamped file, at most
one pending per build, and state must migrate rather than reset.

`schemaVersion()` on each canister reports the deployed stable shape, so you can
always tell what a running canister is on.

### What freezes at go-live

| Thing | Before go-live | After go-live |
|---|---|---|
| Canister IDs / the credential DID | free (`reset` recreates them) | **permanent** — never reinstall or delete |
| Stable shape / migration chain | edit the one file, `reset` | append-only; migrate, never reset |
| Candid interface | change freely | breaking changes break live verifiers |
| Admin set | `reset` + `seed` | governed on-chain, floor enforced |
| Controllers | single local controller is fine | **second controller required** (§4) |
| Business constants (admin floor, later: roles, completion rules) | edit + `reset` | code change + upgrade |

### Go-live checklist

1. All READ FIRST documents in the repo; the gated decisions in §7 made.
2. Phase 2 implemented and the `verify` spike resolved.
3. Full adversarial suite green, including issuance/revocation/tamper cases.
4. **Second controller added** before the registry is ever deployed.
5. Migration chain reviewed — from this point it is append-only.
6. `.icp/data/` committed immediately after the first real deploy.

### One thing to push back on

"Everything changeable" should **not** extend to making security parameters
runtime-mutable after go-live. The registry's admin floor is a compile-time
constant on purpose: if an admin could lower it to 1, the two-key requirement
protecting the credential DID's issuance authority would be defeatable by the
very principals it constrains. Changing it should cost a code change, a review
and an upgrade. Same reasoning applies to issuer-key append-only-ness in Phase 2.

If you want the floor adjustable, the safe shape is **raisable but never
lowerable** — say the word and it is a small change.

---

## 6. Skills protocol — mandatory

Pre-training on ICP/Motoko goes stale every release. **Do not rely on it.**

```bash
npx skills add dfinity/icskills      # pins into .agents/skills/
```

Before writing **any** canister code, load and follow the matching `SKILL.md`,
and say which were loaded. At minimum: `writing-motoko`, `canister-security`,
`stable-memory`, `migrating-motoko-actors`, `icp-cli`. For the registry also:
`certified-variables`, `cloud-engine-canisters`.

Use **`icp`**, never `dfx`. Run `icp <cmd> --help` before any command not
already verified — do not infer flags from dfx. Verify recipe/package versions
rather than recalling them (`@dfinity/motoko@v5.1.0` is current; a recalled
`v5.0.1` 404s).

---

## 7. Deferred work — ask, do not assume

Blocked on Ahmed's decisions. **Do not model or implement these:**

- **`ops` data model + off-chain store wiring** — waits on the funding-note
  storage basis (a UNDP data-protection call, *not ours to make*), which
  off-chain store holds participant names, and the per-role completion-rule
  values.
- **`registry` credential logic (GBA Phase 2)** — threshold Ed25519 signing
  (`lib/Signer.mo`), append-only issuer keys, digest-keyed records, certified
  `issuerKeys`, and the trimmed on-chain record shape. This is fixed by
  `claude/gba-credentials-v1-phase2-decisions.md`.
- **`verify` certified-query spike** — the four unverified assumptions in
  phase2-decisions must be proven on a local replica *first*. If any fails,
  ship an update-call `verify` for v1 and document the upgrade path.
- **Any engine or mainnet deploy** (§4).

### Missing source documents

None of the READ FIRST documents are in this repo. The credential and storage
design cannot be completed without them:

```
claude/personal-data-on-chain.md
claude/opencloud-engine-deployment.md
claude/gba-credentials-v1-plan.md
claude/gba-credentials-v1-phase1-results.md
claude/gba-credentials-v1-phase2-decisions.md
claude/gba-credentials-v1-release-process.md
cohort-tracker-interface-v1.md
```

Ask for them; do not reconstruct them from memory or infer the schema.

---

## 8. Engine constraint that changes the Phase 2 design

From the `cloud-engine-canisters` skill — **worth confirming before building
`lib/Signer.mo`:**

On a CloudEngine subnet, canisters hold **0 cycles** and cycle-bearing
cross-subnet calls (including **threshold Ed25519/Schnorr signing**) must go
through the **engine's proxy canister**, with arguments hand-encoded. Calling
the management canister `aaaaa-aa` directly is correct **locally** but will not
work unchanged on the engine, and derived keys belong to the *proxy*, not to
this canister — which has consequences for the credential DID.

Never attach cycles on an engine call (`IC0504`).

---

## 9. Testing gate

Before anything is called deploy-ready, **actually run it and report real
output**. Never claim a build or test passed without having run it this session.

- `mops check` clean (includes `check-stable` against `deployed/*.most`)
- `mops build` clean
- local-replica integration incl. adversarial cases: anonymous caller,
  non-admin, duplicate issuance, revoked, tampered, unknown digest
- `canister-security` review
- upgrade/migration test (state survives; the chain does not re-run)
- Candid diff against the committed `src/*/**.did`

`./scripts/dev.sh test` runs reset + the full governance suite on both
canisters (29 cases each). The issuance/revocation/tamper cases arrive with
Phase 2. Pre-live, `reset` also re-promotes the `deployed/*.most` baseline;
after go-live the baseline must only ever be promoted after a real deploy.

---

## 10. Architecture

Per `writing-motoko`:

```
src/shared/            Access.mo, Types.mo   — access control, single-sourced
src/<canister>/
  types.mo             domain types
  lib/                 domain logic (Admin.mo; Signer.mo later)
  mixins/              public endpoints
  main.mo              composition root — NO public methods
  migrations/          YYYYMMDD_HHMMSS.mo, mops-managed chain
```

Rules that bite:
- `persistent actor`; stable fields declared **type-only**, no initializers —
  initial values come from the migration chain.
- **No stable state in a mixin** — a bare `let`/`var` there is silently stable
  and traps at runtime (`IC0503`). Pass state in as a parameter.
- Migrations are **self-contained**: only `mo:core` imports, both actor shapes
  inlined. **Never edit or rename a migration that has been deployed.**
- At most **one pending migration per build** — edit the current one rather
  than adding a second.
- `mo:core` only (never `mo:base`), dot notation, no `stable` keyword, no
  `preupgrade`/`postupgrade`.
- Access refusals are **returned** as `#err`, not trapped, so they are testable.
- `include` injects mixin declarations into the **actor's own scope**, so a
  stable field and a mixin method cannot share a name (`M0051`). Hence the
  field `schema` behind the `schemaVersion()` query.

### Admin model

Both canisters carry an admin set with a **floor** (`lib/Admin.mo`). The
registry's floor of **2** is a hard rule: the credential DID's issuance
authority must never reduce to a single point of control. The ops floor is a
scaffold default and needs confirming.

The set starts **empty**; a canister **controller** seeds it via
`bootstrapAdmin` until the floor is met, after which bootstrap closes
permanently and the admins govern each other. Every admin method rejects the
anonymous principal explicitly.

---

## 11. Environment notes

- Toolchain: `icp` (never `dfx`), `mops`, `moc` pinned in `mops.toml`.
- `mops.toml` depends on `core = "2.6.2"` from the mops registry. If the
  registry host (`icp-api.io`) is unreachable, vendor it and point the
  dependency at the local path — see README. Verification for the initial
  scaffold was run that way.
- A sandbox that blocks `api.github.com` cannot auto-fetch the local network
  launcher; set `ICP_CLI_NETWORK_LAUNCHER_PATH` to a manually staged binary.
