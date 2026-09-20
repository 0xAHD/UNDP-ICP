# UNDP AltFinLab — Cohort Tracker (RAW ICP track)

Two canisters:

| Canister   | Purpose | Status |
|------------|---------|--------|
| `ops`      | Internal accelerator-ops state | Governance spine only — data model **gated** |
| `registry` | Public credential rail; its principal is the **permanent credential DID** | Governance spine only — GBA Phase 2 **gated** |

**Read [`CLAUDE.md`](./CLAUDE.md) before changing anything.** It carries the
storage rule, the DID-permanence rule, the deploy gate, and the skills protocol.

## What is implemented

The scaffold and its access-control spine, nothing more:

- `writing-motoko` architecture — `types.mo` / `lib/` / `mixins/` / `main.mo`,
  `persistent actor`, `mo:core`, stable state from day one via the
  mops-managed migration chain.
- Admin set with a floor (2 for `registry`, a hard rule), controller-seeded
  bootstrap that closes permanently, explicit anonymous-principal rejection.

**Not implemented, by design** — threshold Ed25519 signing, issuer keys,
digest-keyed records, certified `issuerKeys`, `verify`, and the `ops` data
model. These are gated on decisions and on documents not present in this repo.
See CLAUDE.md §6.

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
./scripts/dev.sh test     # reset + adversarial suite on both canisters
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

## Adversarial test pass

Requires a running local network and a **fresh deploy** (empty admin set); the
sequence is order-dependent.

```bash
./scripts/dev.sh test                          # both canisters, with reset
./scripts/local-adversarial-test.sh registry   # or one at a time
```

Covers: anonymous caller rejection on every mutating method, controller-only
bootstrap, bootstrap closing permanently at the floor, non-admin rejection,
duplicate admission, the admin floor holding under removal, and unknown-principal
removal, and schema introspection. 29 cases per canister. Issuance /
revocation / tamper cases arrive with Phase 2.

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
