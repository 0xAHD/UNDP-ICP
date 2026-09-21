# UNDP AltFinLab — Cohort Tracker (RAW ICP track)

Four canisters:

| Canister       | Purpose | Status |
|----------------|---------|--------|
| `ops`          | Internal accelerator-ops state: cohorts and per-role completion rules. **No participant data on chain at all** | Built |
| `registry`     | Public credential rail; its principal is the **permanent credential DID** | GBA Phase 2 MVP built |
| `verify_page`  | Public credential verification page | Built |
| `ops_console`  | Internal ops console, Internet Identity sign-in | Built |

**Read [`CLAUDE.md`](./CLAUDE.md) before changing anything.** It carries the
storage rule, the DID-permanence rule, the deploy gate, and the skills protocol.

## What is implemented

- `writing-motoko` architecture — `types.mo` / `lib/` / `mixins/` / `main.mo`,
  `persistent actor`, `mo:core`, stable state from day one via the
  mops-managed migration chain.
- Admin set with a floor (2 for `registry`, a hard rule), controller-seeded
  bootstrap that closes permanently via a stable latch, explicit
  anonymous-principal rejection.
- `ops`: cohorts and per-role completion rules, slug-validated, frozen when a
  cohort closes. **Policy only** — participant progress never touches the chain.
- `registry`: append-only Ed25519 issuer keys, digest-keyed credential records,
  revocation, and `verify`. The canister never signs and never verifies; it
  stores digests and signatures, and the page checks the signature client-side.
- `shared-js/`: the canonical credential format, one source of truth for the
  issuer tool and both pages, so they cannot drift.
- `store/`: the off-chain participant store behind one interface — `local`
  (tested), `sharepoint` (the target, **unverified**, no tenant credentials
  yet), `google` (backup, **unverified**).
- `verify-page/`: the public verification page. The credential document rides
  in the URL **fragment**, which browsers never send to a server.
- `ops-console/`: the internal console — cohorts, completion rules, credential
  status and revocation, with Internet Identity sign-in. **Issuing is
  deliberately absent**: it needs the issuer private key, which is held off
  chain and must never reach a browser.

**Not implemented, by design** — threshold signing (the issuer key is an
ordinary Ed25519 key held off chain, a pilot-only posture), and a certified-
query `verify` (the MVP ships the simpler update call). Both have written
upgrade paths. See CLAUDE.md §4a and §7.

## Setup

```bash
npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm ic-mops   # icp, never dfx
npx skills add dfinity/icskills                            # pin the IC skills
mops install     # resolves core@2.6.2 and generates mops.lock — commit the lock
```

`mops.lock` is intentionally absent: it was not generated here, because this
sandbox cannot reach the mops registry. The first `mops install` on a connected
machine creates it; commit it then.

## Build and check

```bash
mops check          # type check, lint, + stable-compat vs deployed/*.most
mops build          # wasm + candid
mops generate candid  # refresh src/<name>/<name>.did, then diff before commit
```

## Iterating

One entry point for the whole local loop:

```bash
./scripts/dev.sh reset    # wipe state, fresh install  <- after ANY stable-shape change
./scripts/dev.sh seed     # bootstrap admins to the floor
./scripts/dev.sh up       # upgrade in place, keeping state (compatible changes)
./scripts/dev.sh test     # reset + the full gate (176 cases)
./scripts/dev.sh status   # canister IDs, schema versions, admin counts
./scripts/dev.sh down     # stop the network
```

`up` refuses stable-incompatible changes and tells you to `reset` — that is the
guard rail working. While pre-live, fold schema changes into the single
migration file and `reset`; at go-live that file freezes and changes become
append-only. See CLAUDE.md §5 for what freezes and the go-live checklist.

## Local replica (manual)

```bash
icp network start -d
icp deploy -e local --identity <your-local-identity>
icp network stop
```

Local test identities (throwaway, plaintext — never for anything of value):

```bash
icp identity new ct-admin-a --storage plaintext   # canister controller
icp identity new ct-admin-b --storage plaintext
icp identity new ct-outsider --storage plaintext
```

`ahmed-opencloud` is **engine-only** — do not use it locally.

## The test gate

Requires a running local network and a **fresh deploy** (empty admin set); the
sequence is order-dependent.

```bash
./scripts/dev.sh test                          # both canisters, with reset
./scripts/local-adversarial-test.sh registry   # or one at a time
```

`./scripts/dev.sh test` is the whole gate — **176 cases**:

| Suite | Cases |
|---|---|
| Governance / adversarial, per canister (`local-adversarial-test.sh`) | 34 × 2 |
| Cohorts and completion rules (`ops-cohorts-test.sh`) | 28 |
| Off-chain store and eligibility (`store-test.mjs`) | 16 |
| End-to-end credential flow, real Ed25519 (`credential-flow-test.mjs`) | 28 |
| Verification page, real browser (`page-test.mjs`) | 14 |
| Ops console signed out, real browser (`console-test.mjs`) | 22 |

The governance suites cover anonymous-caller rejection on every mutating
method, controller-only bootstrap, bootstrap latching shut permanently at the
floor, non-admin rejection, duplicate admission, the floor holding under
removal, unknown-principal removal, and schema introspection. The credential
flow adds duplicate issuance, revoked, tampered and unknown-digest cases.

**What the gate does NOT cover:** the Internet Identity sign-in ceremony. It
needs a real identity provider and a human at the keyboard. That is acceptable
only because the console is not a security boundary — every mutating call is
authorised in the canister, which the governance suites cover. Do not move an
authorisation decision into the page.

Both browser suites take `SHOT=<path>` to write a full-page screenshot.

## Sandbox workarounds

Needed only where outbound egress is restricted; neither applies on a normal
machine.

- **mops registry blocked** (`Host not in allowlist: icp-api.io`) — vendor core
  and point the dependency at it:
  ```bash
  git clone --depth 1 --branch v2.6.2 https://github.com/dfinity/motoko-core /path/to/motoko-core
  # then in mops.toml: core = "/path/to/motoko-core"
  ```
- **`api.github.com` blocked** — `icp network start` cannot fetch its launcher.
  Download the release asset manually and export:
  ```bash
  export ICP_CLI_NETWORK_LAUNCHER_PATH=/path/to/icp-cli-network-launcher
  ```
