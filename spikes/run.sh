#!/usr/bin/env bash
# Reproduce both spikes on a local replica. THROWAWAY — local only, port 8100.
# See FINDINGS.md for what these established.
set -uo pipefail
cd "$(dirname "$0")"
export DO_NOT_TRACK=1
ENV_NAME=local
ID=${IDENTITY:-ct-admin-a}

command -v icp  >/dev/null || { echo "icp not found";  exit 1; }
command -v node >/dev/null || { echo "node not found"; exit 1; }
[[ -d node_modules ]] || { echo "==> npm install"; npm install --no-save @icp-sdk/core >/dev/null 2>&1; }

echo "==> starting spike network (port 8100)"
icp network status -e "$ENV_NAME" >/dev/null 2>&1 || icp network start -d >/dev/null 2>&1 \
  || { echo "network failed (restricted sandbox? set ICP_CLI_NETWORK_LAUNCHER_PATH)"; exit 1; }

echo "==> deploying spikes"
icp deploy -e "$ENV_NAME" --identity "$ID" >/dev/null 2>&1 || { icp deploy -e "$ENV_NAME" --identity "$ID"; exit 1; }
cid() { icp canister status "$1" -e "$ENV_NAME" --identity "$ID" 2>/dev/null | awk '/Canister Id:/{print $3; exit}'; }
SIGNER=$(cid spike_signer); CERT=$(cid spike_certified)
echo "    spike_signer    = $SIGNER"
echo "    spike_certified = $CERT"

echo
echo "=== SPIKE 1: threshold Ed25519 ==="
for k in dfx_test_key insecure_test_key_1 test_key_1 key_1; do
  printf '  probePublicKey(%-20s) ' "\"$k\""
  icp canister call spike_signer probePublicKey "(\"$k\")" -e "$ENV_NAME" --identity "$ID" </dev/null 2>&1 \
    | grep -qE 'size = 32' && echo "OK (32-byte key)" || echo "unavailable"
done
echo "  probeSign(dfx_test_key, cycles=0)            -> $(icp canister call spike_signer probeSign '("dfx_test_key","cohort-tracker-spike",0:nat)' -e "$ENV_NAME" --identity "$ID" </dev/null 2>&1 | grep -oE '[0-9_]+ cycles are required' | head -1)"
echo "  probeSign(dfx_test_key, cycles=30e9)         -> $(icp canister call spike_signer probeSign '("dfx_test_key","cohort-tracker-spike",30000000000:nat)' -e "$ENV_NAME" --identity "$ID" </dev/null 2>&1 | grep -oE 'size = 64 : nat' | head -1) (64-byte signature)"

echo
echo "=== SPIKE 2: certified queries ==="
D='blob "\aa\bb\cc\dd\ee\ff\00\11\22\33\44\55\66\77\88\99\aa\bb\cc\dd\ee\ff\00\11\22\33\44\55\66\77\88\99"'
icp canister call spike_certified certify "($D)" -e "$ENV_NAME" --identity "$ID" </dev/null >/dev/null 2>&1
echo "  -- after certify --"
node verify-certificate.mjs "$CERT" 2>&1 | sed 's/^/  /'
echo "  -- after upgrade (does certification survive?) --"
printf '\n// run.sh upgrade marker\n' >> src/certified/main.mo
icp deploy -e "$ENV_NAME" --identity "$ID" >/dev/null 2>&1
git checkout -- src/certified/main.mo 2>/dev/null || true
node verify-certificate.mjs "$CERT" 2>&1 | grep -E 'certified_data|MATCHES' | sed 's/^/  /'
echo "  -- negative control: serve an UNCERTIFIED value --"
T='blob "\de\ad\be\ef\de\ad\be\ef\de\ad\be\ef\de\ad\be\ef\de\ad\be\ef\de\ad\be\ef\de\ad\be\ef\de\ad\be\ef"'
icp canister call spike_certified tamper "($T)" -e "$ENV_NAME" --identity "$ID" </dev/null >/dev/null 2>&1
node verify-certificate.mjs "$CERT" 2>&1 | grep -E 'MATCHES' | sed 's/^/  /'
echo "  (MATCHES must be false above — that is the client rejecting tampered data)"

echo
echo "==> done. 'icp network stop' in this directory to shut the spike network down."
