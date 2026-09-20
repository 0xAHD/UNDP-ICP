#!/usr/bin/env bash
# Local iteration loop for the Cohort Tracker. LOCAL REPLICA ONLY.
#
#   ./scripts/dev.sh reset    wipe local state, fresh install (schema changes)
#   ./scripts/dev.sh seed     bootstrap admins up to the floor
#   ./scripts/dev.sh up       upgrade in place, keeping state (compatible changes)
#   ./scripts/dev.sh test     reset, adversarial suites, credential flow, page suite
#   ./scripts/dev.sh status   canister IDs, schema versions, admin counts
#   ./scripts/dev.sh down     stop the local network
#
# This script refuses to touch anything but the `local` environment. Engine and
# mainnet deploys are a separate, separately-confirmed step — see CLAUDE.md.
set -uo pipefail
cd "$(dirname "$0")/.."
export DO_NOT_TRACK=1

ENV_NAME=local
CTRL=ct-admin-a                       # canister controller / first admin
IDENTITIES=(ct-admin-a ct-admin-b ct-outsider)

die() { echo "ERROR: $*" >&2; exit 1; }
hr()  { printf '%s\n' "------------------------------------------------------------"; }

ensure_identities() {
  for id in "${IDENTITIES[@]}"; do
    if ! icp identity list 2>/dev/null | grep -qw "$id"; then
      echo "  creating throwaway identity: $id"
      icp identity new "$id" --storage plaintext --quiet >/dev/null 2>&1 \
        || die "could not create identity $id"
    fi
  done
}

principal() { icp identity principal --identity "$1" 2>/dev/null | tail -1; }

canister_id() {
  icp canister status "$1" -e "$ENV_NAME" --identity "$CTRL" 2>/dev/null \
    | awk '/Canister Id:/{print $3; exit}'
}

net_up() {
  icp network status -e "$ENV_NAME" >/dev/null 2>&1 && return 0
  echo "  starting local network..."
  icp network start -d >/dev/null 2>&1 || die "network failed to start (in a restricted sandbox, set ICP_CLI_NETWORK_LAUNCHER_PATH)"
}

cmd_down() {
  echo "==> stopping local network"
  icp network stop >/dev/null 2>&1 && echo "  stopped" || echo "  (was not running)"
}

cmd_reset() {
  echo "==> RESET: wiping local replica state and reinstalling from scratch"
  echo "    (use this after ANY change to the stable shape / migration chain)"
  icp network stop >/dev/null 2>&1
  rm -rf .icp/cache/networks/"$ENV_NAME"
  ensure_identities
  net_up
  # Pre-live semantics: a wiped replica has no deployment history, so the
  # stable baseline resets to the empty actor and the whole chain replays.
  # `mops deployed init` is idempotent and will NOT overwrite an existing
  # baseline, so the stale one has to go first.
  echo "  resetting stable baseline to empty-actor (pre-live only)"
  rm -f deployed/*.most
  mops deployed init >/dev/null 2>&1 || die "mops deployed init failed"
  echo "  building..."
  mops build >/dev/null 2>&1 || { mops build; die "build failed"; }
  echo "  deploying fresh..."
  icp deploy -e "$ENV_NAME" --identity "$CTRL" >/dev/null 2>&1 \
    || { icp deploy -e "$ENV_NAME" --identity "$CTRL"; die "deploy failed"; }
  echo "  promoting baseline to the just-deployed shape"
  mops deployed >/dev/null 2>&1 || die "mops deployed failed"
  hr; cmd_status
}

cmd_up() {
  echo "==> UP: upgrading in place, preserving state"
  echo "    (only valid for stable-COMPATIBLE changes; if this fails, use reset)"
  ensure_identities; net_up
  mops check || die "check failed — fix it, or if you changed the stable shape run: ./scripts/dev.sh reset"
  icp deploy -e "$ENV_NAME" --identity "$CTRL" >/dev/null 2>&1 \
    || { icp deploy -e "$ENV_NAME" --identity "$CTRL"; die "upgrade failed — if the shape changed, run: ./scripts/dev.sh reset"; }
  mops deployed >/dev/null 2>&1
  hr; cmd_status
}

cmd_seed() {
  echo "==> SEED: bootstrapping admins up to the floor"
  ensure_identities
  local a b
  a=$(principal ct-admin-a); b=$(principal ct-admin-b)
  for c in registry ops; do
    local floor; floor=$(icp canister call "$c" adminFloor '()' --query -e "$ENV_NAME" \
                          --identity "$CTRL" </dev/null 2>/dev/null | tr -dc '0-9')
    echo "  $c (floor ${floor:-?}):"
    for p in "$a" "$b"; do
      local out; out=$(icp canister call "$c" bootstrapAdmin "(principal \"$p\")" \
                        -e "$ENV_NAME" --identity "$CTRL" </dev/null 2>&1 | tail -1)
      echo "    bootstrapAdmin ${p:0:12}... -> $out"
    done
  done
  hr; cmd_status
}

cmd_status() {
  echo "==> STATUS  (network: $ENV_NAME)"
  if ! icp network status -e "$ENV_NAME" >/dev/null 2>&1; then
    echo "  local network is DOWN"; return 0
  fi
  printf '  %-9s %-30s %-8s %-7s %s\n' CANISTER ID SCHEMA ADMINS FLOOR
  for c in registry ops; do
    local id ver n floor
    id=$(canister_id "$c"); [[ -z "$id" ]] && { printf '  %-9s %s\n' "$c" "(not deployed)"; continue; }
    ver=$(icp canister call "$c" schemaVersion '()' --query -e "$ENV_NAME" --identity "$CTRL" </dev/null 2>/dev/null | tr -dc '0-9')
    n=$(icp canister call "$c" adminCount '()' --query -e "$ENV_NAME" --identity "$CTRL" </dev/null 2>/dev/null | tr -dc '0-9')
    floor=$(icp canister call "$c" adminFloor '()' --query -e "$ENV_NAME" --identity "$CTRL" </dev/null 2>/dev/null | tr -dc '0-9')
    printf '  %-9s %-30s %-8s %-7s %s\n' "$c" "$id" "${ver:-?}" "${n:-?}" "${floor:-?}"
  done
}

cmd_test() {
  cmd_reset
  local fail=0
  for c in registry ops; do
    hr; echo "==> ADVERSARIAL SUITE: $c"
    ./scripts/local-adversarial-test.sh "$c" || fail=1
  done
  # The adversarial suites leave the admin set seeded at the floor, so the
  # credential flow can run straight after without re-seeding.
  hr; echo "==> CREDENTIAL FLOW (end-to-end, real Ed25519)"
  node ./scripts/credential-flow-test.mjs || fail=1
  # The page is the product surface — a break there matters as much as a
  # canister break, so it is part of the gate rather than a manual check.
  hr; echo "==> VERIFICATION PAGE (real browser)"
  node ./scripts/page-test.mjs || fail=1
  hr
  [[ $fail -eq 0 ]] && echo "ALL SUITES PASSED" || { echo "SUITE FAILURES"; return 1; }
}

case "${1:-}" in
  reset)  cmd_reset  ;;
  seed)   cmd_seed   ;;
  up)     cmd_up     ;;
  test)   cmd_test   ;;
  status) cmd_status ;;
  down)   cmd_down   ;;
  *) sed -n '2,12p' "$0" | sed 's/^# \?//'; exit 1 ;;
esac
