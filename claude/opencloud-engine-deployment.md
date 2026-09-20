# OpenCloud engine — toolchain and deployment constraints

**Status.** Authored 2026-09-20 to replace a missing original. Tags: **[RULE]**
binding · **[VERIFIED]** proven on a local replica this session · **[SKILL]**
from the pinned `dfinity/icskills` guidance, not independently verified here ·
**[NEEDS INPUT]** only Ahmed can supply.

---

## 1. Toolchain

**[RULE]** Use `icp`, never `dfx`. They are not flag-compatible; config is
`icp.yaml`, not `dfx.json`, and canisters are an **array**, not a keyed object.
Run `icp <cmd> --help` before any command not already verified.

**[VERIFIED]** Working set as of 2026-09-20:

```bash
npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm ic-mops
```

| Tool | Version |
|---|---|
| `icp` | 1.5.0 |
| `mops` | 3.2.3 |
| `moc` | 1.16.1 (pinned in `mops.toml`) |
| `core` | 2.6.2 |
| Motoko recipe | `@dfinity/motoko@v5.1.0` |

**[VERIFIED]** Verify versions rather than recalling them. A recalled
`@dfinity/motoko@v5.0.1` returns 404; v5.1.0 is current. Recipe versions must be
pinned explicitly — icp-cli rejects unpinned references.

---

## 2. What a cloud engine is

**[SKILL]** An engine is a user-owned slice of IC capacity on a **CloudEngine
subnet** with a **free cycles schedule**: execution, storage, messaging and
HTTPS outcalls all cost zero, and engine canisters hold a **0 cycles balance by
design**.

That model is protocol-enforced, so code that works on an application subnet can
fail on an engine in ways that look like cycles or consensus bugs.

---

## 3. The four engine rules

**[SKILL]**

1. **Never attach cycles.** Remove every `(with cycles = …)`. Any non-zero
   amount fails with `IC0504`. Do not "fix" it by passing `cycles = 0` — omit
   the clause entirely.
2. **Cross-subnet calls must be bounded-wait** — `(with timeout = N)` in Motoko.
   Otherwise: *"Unbounded-wait calls and calls with cycles are not allowed to
   CloudEngine subnets."*
3. **HTTPS outcalls use the ordinary wrapper and are free.** Never route them
   through the proxy — no transform applies (*"Replicas had different
   responses"*) and the proxy's budget drains into `InsufficientCycles`.
   Management-canister wrappers ask the system API for the fee and get 0 on an
   engine, so the same source stays portable. Never hardcode a fee.
4. **Cycle-bearing cross-subnet targets go through the console proxy** — XRC,
   threshold ECDSA/Schnorr, vetKD. Arguments are hand-encoded; the `ic-vetkeys`
   and `ic-cdk` helpers attach cycles and therefore do not work here.

---

## 4. Threshold signing — the constraint that shapes the credential rail

**[SKILL]** **Cloud engines provide no threshold signing at all.** An engine
canister reaches mainnet's signing only via the console proxy.

**[SKILL]** `sign_with_schnorr` has no `canister_id` field — the key is always
the caller's, and behind the proxy **the caller is the proxy**. The proxy
inserts your canister's principal as `derivation_path[0]`, so callers are
isolated from each other, but the root of the derivation is the proxy.

> The issuer signing key is anchored to **(proxy canister id) + [registry
> principal, …]** — **not** to `registry` alone.

- A different proxy derives different keys; the old key is unrecoverable.
- **Deleting a proxy destroys its keys permanently.** The console's delete
  button refunds cycles; it cannot give back the derivation.
- A self-deployed proxy does no caller isolation, so it derives differently
  again. The two kinds are not substitutes.

**[NEEDS INPUT]** This qualifies "the registry's principal IS the credential
DID". See `gba-credentials-v1-phase2-decisions.md` §3 for the three options and
the decision still owed.

**[VERIFIED]** What does work locally, so Phase 2 is developable: `aaaaa-aa`
threshold Ed25519 on a local replica — keys `dfx_test_key`, `key_1`,
`test_key_1`; 32-byte public key (free); 64-byte signature costing
**10_000_000_000 cycles**; signatures verify with stock Ed25519 off-chain.

---

## 5. Deploy gate

**[RULE]** **Local replica only** at this phase. `icp.yaml` deliberately defines
no engine or mainnet environment.

**[RULE]** Before any engine or mainnet deploy:

1. A **second controller** must be in place. A single controller is both a
   key-loss risk and — more sharply — the real authority over the rail, since a
   controller can upgrade past every admin rule (see
   `../CLAUDE.md` §11, standing constraint 1).
2. The §4 proxy/DID decision must be made, because it is permanent.
3. Irreversible actions (`reinstall`, `delete`, `stop`, controller change,
   cycle withdrawal) need per-action confirmation naming the canister and
   effect. Always state network + canister ID + identity before acting.

**[RULE]** `registry` must **never** be reinstalled or deleted. Commit
`.icp/data/` — it holds the canister-name → canister-ID mapping. Note that a
*managed local* network keeps IDs in `.icp/cache/`, so `.icp/data/` only appears
after a connected deploy; do not "clean up" `.icp/` because it looks empty.

**[RULE]** The `ahmed-opencloud` identity is **engine-only**. Local work uses
throwaway identities (`ct-admin-a`, `ct-admin-b`, `ct-outsider`).

---

## 6. Engine deploy procedure

**[SKILL]** Not yet exercised — recorded for when the gate opens.

- Link the console identity: `icp identity link web` (defaults to
  `https://opencloud.org`). A delegation handoff covers sandboxes the browser
  cannot reach.
- Deploy with `-e <environment>`, never `--network ic`.
- Tag canisters with `__META_*` for a named console app.
- Bake version metadata (`service:git:sha`) into the wasm.
- Deploy and fund the proxy if any signing is needed — card-funded from the
  console, or self-deployed via `icp new --subfolder proxy`.

**[NEEDS INPUT]** The engine's subnet id, the console app name, and the proxy
canister id once it exists. The proxy id is **permanent infrastructure** for
this app (§4) and belongs in version control once known.

---

## 7. Restricted-network workarounds

**[VERIFIED]** Needed only where outbound egress is filtered; neither applies on
a normal machine.

- **mops registry blocked** (`Host not in allowlist: icp-api.io`) — vendor core
  and point the dependency at the local path:
  ```bash
  git clone --depth 1 --branch v2.6.2 https://github.com/dfinity/motoko-core /path/to/motoko-core
  # mops.toml:  core = "/path/to/motoko-core"
  ```
  Do not commit that path, and do not commit the `mops.lock` it generates.
- **`api.github.com` blocked** — `icp network start` cannot fetch its launcher.
  Stage the release asset manually and export:
  ```bash
  export ICP_CLI_NETWORK_LAUNCHER_PATH=/path/to/icp-cli-network-launcher
  ```
  Asset name embeds the tag:
  `icp-cli-network-launcher-x86_64-linux-<tag>.tar.gz`.
