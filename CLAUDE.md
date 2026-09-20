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
- **Qualified by §8:** the DID *identifier* is this principal, but on a cloud
  engine the *signing key* behind it is anchored to the console proxy. Read §8
  before treating this canister as the sole root of the credential rail.
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
- ~~**`registry` credential logic (GBA Phase 2)**~~ — **BUILT 2026-09-20** as
  the MVP, per the decisions in `claude/gba-credentials-v1-phase2-decisions.md`
  §0. Issuer key is **off chain** (option C), so there is no `lib/Signer.mo`,
  no threshold signing, no proxy, no cycles and **no `await` anywhere** in the
  canister. `verify` is an **update call**, not a certified query.
- ~~**`verify` certified-query spike**~~ — **DONE**, see `spikes/FINDINGS.md`.
  Certified queries work, but the MVP deliberately ships the simpler
  update-call `verify`; the upgrade path is in phase2-decisions §5.
- **Any engine or mainnet deploy** (§4).

**Now unblocked by the spikes** (`spikes/FINDINGS.md`): the signing and
certified-query mechanisms are proven locally, so Phase 2 can be built as soon
as the record shape arrives. The open *decision* is the proxy/DID question in
§8, which is Ahmed's, not ours.

### Source documents

**Authored 2026-09-20 — they did not exist before and were NOT reconstructed.**
Each tags its claims: **[VERIFIED]** proven this session · **[RULE]** stated by
Ahmed · **[PROPOSED]** needs sign-off · **[NEEDS INPUT]** only Ahmed or UNDP can
settle.

| Document | Status |
|---|---|
| `claude/personal-data-on-chain.md` | Binding. Expands §1; adds the digest/re-identification rule |
| `claude/opencloud-engine-deployment.md` | Toolchain + engine constraints + deploy gate |
| `claude/gba-credentials-v1-plan.md` | Rail design and trust model — proposed |
| `claude/gba-credentials-v1-phase1-results.md` | **Records only work actually run.** Explicit gaps where a prior Phase 1 would go |
| `claude/gba-credentials-v1-phase2-decisions.md` | **Proposals, not recovered decisions.** Carries the DECISIONS OWED that block Phase 2 |
| `claude/gba-credentials-v1-release-process.md` | Freeze point, release gate, go-live checklist, rollback |
| `cohort-tracker-interface-v1.md` | Implemented interface + Phase 2 sketch |

**Read the ⚠ banners in `-phase1-results.md` and `-phase2-decisions.md` before
relying on either.** Neither recovers a lost original; content is proposed or
evidenced, never invented. If the real originals surface, reconcile rather than
assuming these supersede them.

**Phase 2 is still blocked** — not on feasibility (the spikes settled that) but
on the **DECISION OWED** items in `-phase2-decisions.md`, chiefly the on-chain
record shape (§2) and the proxy/DID question (§3).

---

## 8. Engine constraint that changes the Phase 2 design

**Verified by spike, 2026-09-20 — see `spikes/FINDINGS.md`.**

**Cloud engines provide no threshold signing at all.** An engine canister
reaches mainnet's signing only through the **console proxy canister**.
`sign_with_schnorr` has no `canister_id` field — the key is always the caller's,
and behind the proxy the caller is the proxy. So:

> The issuer signing key is anchored to **(proxy canister id) + [registry
> principal, …]**, **not** to `registry` alone.

- A different proxy derives different keys; the old key is unrecoverable.
- **Deleting a proxy destroys its keys permanently.**
- A self-deployed proxy does no caller isolation, so it derives differently again.

**This qualifies §2.** `registry`'s principal can be the credential DID as an
*identifier*, but the signing key behind it depends on the proxy. The proxy is
then permanent infrastructure, as load-bearing as the canister — and deletable
from a console UI. **Decide before go-live** (options in `spikes/FINDINGS.md`
§2): accept the proxy as permanent, put `registry` on mainnet instead so it
signs via `aaaaa-aa` directly, or keep the issuer key off-chain.

Never attach cycles on an engine call (`IC0504`). HTTPS outcalls are free and
must not go through the proxy.

**What does work locally** (so Phase 2 is developable): `aaaaa-aa`
threshold Ed25519 on a local replica — keys `dfx_test_key`, `key_1`,
`test_key_1`; 32-byte public key (free), 64-byte signature, 10_000_000_000
cycles per signature. Signatures verify with stock Ed25519 off-chain.

## 9. Testing gate

Before anything is called deploy-ready, **actually run it and report real
output**. Never claim a build or test passed without having run it this session.

- `mops check` clean (includes `check-stable` against `deployed/*.most`)
- `mops build` clean
- local-replica integration incl. adversarial cases: anonymous caller,
  non-admin, duplicate issuance, revoked, tampered, unknown digest
  — **all covered as of 2026-09-20**: 34 governance cases per canister plus a
  28-case end-to-end credential flow signing with a real Ed25519 key
- `canister-security` review — **done 2026-09-20, see §11**
- upgrade/migration test (state survives; the chain does not re-run)
- Candid diff against the committed `src/*/**.did`
- the verification page driven in a real browser against the local replica
  (`scripts/shoot-link.mjs`, `scripts/shoot-verify-page.mjs`) — **done
  2026-09-20**: valid, revoked, tampered, broken-link and landing states all
  confirmed. Credential links put the document in the URL **fragment**, which
  browsers never send to a server — keep it that way; a query param would leak
  the holder's name to the gateway.

Spike results that change the gate (`spikes/FINDINGS.md`): the certified-query
path verifies end to end locally, and **certified data survives a canister
upgrade** — so the `certified-variables` skill's pitfall 7 (re-certify in
`postupgrade`) does not bite our persistence model. Confirm on mainnet before
relying on it. A certified-query `verify` is therefore viable for v1; the four
assumptions in `phase2-decisions` remain untested because that document is
still missing.

`./scripts/dev.sh test` runs reset + the governance suites on both canisters
(34 cases each) + the end-to-end credential flow (28 cases) — **96 in total**.
Pre-live, `reset` also re-promotes the `deployed/*.most` baseline;
after go-live the baseline must only ever be promoted after a real deploy.

---

## 10. Architecture

Per `writing-motoko`:

```
src/shared/            Access.mo, Types.mo   — access control, single-sourced
src/<canister>/
  types.mo             domain types
  lib/                 domain logic (Admin.mo; registry adds Issuer.mo,
                       Credentials.mo — there is NO Signer.mo: the issuer key
                       is off chain and the canister never signs)
  mixins/              public endpoints (registry adds Issuance.mo, Verify.mo)
  main.mo              composition root — NO public methods
  migrations/          YYYYMMDD_HHMMSS.mo, mops-managed chain

shared-js/             canonical credential format — ONE source of truth for
                       the issuer and the page, so they cannot drift
verify-page/           public verification page (static-site canister)
scripts/               dev loop, adversarial suite, issuer tool, page driver
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
`bootstrapAdmin` until the floor is met, which sets a **stable latch**
(`bootstrap.closed`) that is never cleared — so bootstrap stays shut even if the
floor is later raised (§11). From then on the admins govern each other. Every
admin method rejects the anonymous principal explicitly, and `#anonymousTarget`
is distinct from `#anonymousCaller`.

**The floor binds admins, not controllers** — see §11, standing constraint 1.

---

## 11. Security review — 2026-09-20

Full `canister-security` + `reviewing-motoko` pass over the access-control
spine. One code defect found and fixed; the rest are standing constraints that
Phase 2 must respect.

### Fixed

**Bootstrap did not actually latch (Blocker-shaped).** `bootstrapAdmin` derived
"closed" from `admins.size() >= floor`. That is not permanent: **raising** the
floor later — which §5 explicitly permits — makes the set fall below it and
silently **reopens a controller-only path into the admin set**, bypassing
admin-governed `addAdmin`. Now a stable `bootstrap.closed` latch, set once when
the floor is reached and never cleared. Regression-tested by raising the
registry floor to 3 with 2 admins: latch stayed `true`, `bootstrapAdmin`
returned `#bootstrapClosed`.

**`#anonymousCaller` was overloaded**, meaning both "you are anonymous" and
"you offered the anonymous principal as a target". Split out `#anonymousTarget`.

### Standing constraints — not bugs, do not "fix" in code

**1. Controllers outrank every rule in this repo.** A controller can upgrade or
reinstall the canister and replace the admin logic wholesale. So the two-admin
floor constrains *admins*, never *controllers*. **Today there is exactly one
local controller, which makes the floor decorative.** §4 already gates the
engine deploy on a second controller, but frames it as key-loss insurance; the
sharper point is **authority**: whoever controls `registry` can mint credentials
regardless of the admin floor. Before go-live the controller set is the real
trust root of the credential rail and must be at least as strong as the floor it
is supposed to protect — two-of-N, a governance canister, or blackholing once
the rail stabilises. **This is a decision for Ahmed, not a code change.**

**2. Queries are uncertified.** `listAdmins`, `adminCount`, `adminFloor`,
`bootstrapClosed`, `callerIsAdmin` and `schemaVersion` are plain `query` calls,
answered by a single replica that could lie. Fine for UI display; **never let a
verifier or another canister make a trust decision on them.** Phase 2's `verify`
must use the certified path (proven viable in `spikes/FINDINGS.md`).

**3. Recovery is controller-only.** If both admins lose their keys, the floor
blocks removal and the latch blocks bootstrap, so the admin set becomes
unreachable. The only recovery is a controller upgrade — another reason (1)
matters.

**4. Cycle-drain surface.** Every update method is callable by anyone; rejection
still burns cycles. Free on a cloud engine, real on mainnet — so weigh it if the
§8 decision puts `registry` on mainnet. `inspect_message` is a legitimate
*cycle-saving* optimisation only, **never** a security boundary; access checks
stay inside every method.

### Phase 2 must handle

**TOCTOU across `await`.** Nothing in the current code awaits, so there is no
reentrancy exposure today. `lib/Signer.mo` changes that: `requireAdmin` →
`await sign(...)` → mutate state is the classic hole, because the admin set can
change across the await. Use the CallerGuard pattern from `canister-security`,
and re-check authorisation *after* the await before committing state.

## 12. Environment notes

- Toolchain: `icp` (never `dfx`), `mops`, `moc` pinned in `mops.toml`.
- `mops.toml` depends on `core = "2.6.2"` from the mops registry. If the
  registry host (`icp-api.io`) is unreachable, vendor it and point the
  dependency at the local path — see README. Verification for the initial
  scaffold was run that way.
- A sandbox that blocks `api.github.com` cannot auto-fetch the local network
  launcher; set `ICP_CLI_NETWORK_LAUNCHER_PATH` to a manually staged binary.
