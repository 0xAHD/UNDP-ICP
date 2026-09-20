#!/usr/bin/env bash
# Local-replica adversarial test pass for the Cohort Tracker governance spine.
#
# LOCAL ONLY. Never point this at the engine or mainnet.
# Expects: a running local network (`icp network start -d`) and a fresh deploy,
# i.e. an EMPTY admin set. The sequence below is order-dependent.
#
# Identities: ct-admin-a (canister controller), ct-admin-b, ct-outsider.
set -uo pipefail
cd "$(dirname "$0")/.."

ENV_NAME=local
CANISTER="${1:-registry}"
PASS=0; FAIL=0

A=$(icp identity principal --identity ct-admin-a 2>/dev/null | tail -1)
B=$(icp identity principal --identity ct-admin-b 2>/dev/null | tail -1)
O=$(icp identity principal --identity ct-outsider 2>/dev/null | tail -1)
ANON="2vxsx-fae"

echo "NETWORK : $ENV_NAME (managed, port 8000)"
echo "CANISTER: $CANISTER -> $(icp canister status "$CANISTER" -e "$ENV_NAME" --identity ct-admin-a 2>/dev/null | awk '/Canister Id:/{print $3; exit}')"
echo "ct-admin-a (controller) = $A"
echo "ct-admin-b              = $B"
echo "ct-outsider             = $O"
echo

# check <label> <identity> <expected> <method> [args]
check() {
  local label="$1" id="$2" want="$3" method="$4" args="${5:-()}"
  local got
  got=$(timeout 120 icp canister call "$CANISTER" "$method" "$args" \
          -e "$ENV_NAME" --identity "$id" </dev/null 2>&1 | tail -1)
  if [[ "$got" == *"$want"* ]]; then
    printf '  PASS  %-46s %s\n' "$label" "$got"; PASS=$((PASS+1))
  else
    printf '  FAIL  %-46s got:%s want:%s\n' "$label" "$got" "$want"; FAIL=$((FAIL+1))
  fi
}

echo "-- baseline (fresh install) --"
check "adminFloor is 2"                 ct-admin-a "(2 : nat)"       adminFloor
check "adminCount starts 0"             ct-admin-a "(0 : nat)"       adminCount
check "listAdmins starts empty"         ct-admin-a "(vec {})"        listAdmins

echo "-- anonymous caller is rejected --"
check "anon addAdmin"                   anonymous  "anonymousCaller" addAdmin       "(principal \"$A\")"
check "anon removeAdmin"                anonymous  "anonymousCaller" removeAdmin    "(principal \"$A\")"
check "anon bootstrapAdmin"             anonymous  "anonymousCaller" bootstrapAdmin "(principal \"$A\")"
check "anon callerIsAdmin is false"     anonymous  "(false)"         callerIsAdmin

echo "-- bootstrap is controller-only --"
check "non-controller bootstrap"        ct-outsider "notAuthorized"  bootstrapAdmin "(principal \"$O\")"
check "cannot bootstrap anonymous"      ct-admin-a  "anonymousCaller" bootstrapAdmin "(principal \"$ANON\")"
check "controller bootstraps A"         ct-admin-a  "ok"             bootstrapAdmin "(principal \"$A\")"
check "duplicate bootstrap of A"        ct-admin-a  "alreadyAdmin"   bootstrapAdmin "(principal \"$A\")"
check "adminCount now 1"                ct-admin-a  "(1 : nat)"      adminCount
check "controller bootstraps B"         ct-admin-a  "ok"             bootstrapAdmin "(principal \"$B\")"
check "adminCount now 2"                ct-admin-a  "(2 : nat)"      adminCount

echo "-- bootstrap closes permanently at the floor --"
check "bootstrap after floor reached"   ct-admin-a  "bootstrapClosed" bootstrapAdmin "(principal \"$O\")"

echo "-- admin-only mutation --"
check "non-admin addAdmin"              ct-outsider "notAuthorized"  addAdmin       "(principal \"$O\")"
check "non-admin removeAdmin"           ct-outsider "notAuthorized"  removeAdmin    "(principal \"$B\")"
check "admin adds outsider"             ct-admin-a  "ok"             addAdmin       "(principal \"$O\")"
check "duplicate addAdmin"              ct-admin-a  "alreadyAdmin"   addAdmin       "(principal \"$O\")"
check "adminCount now 3"                ct-admin-a  "(3 : nat)"      adminCount

echo "-- the admin floor holds --"
check "remove down to floor is allowed" ct-admin-a  "ok"             removeAdmin    "(principal \"$O\")"
check "adminCount back to 2"            ct-admin-a  "(2 : nat)"      adminCount
check "remove AT floor is refused"      ct-admin-a  "adminFloor"     removeAdmin    "(principal \"$B\")"
check "remove unknown principal"        ct-admin-a  "unknownAdmin"   removeAdmin    "(principal \"$O\")"
check "adminCount still 2"              ct-admin-a  "(2 : nat)"      adminCount

echo "-- identity reflection --"
check "admin sees callerIsAdmin true"   ct-admin-a  "(true)"         callerIsAdmin
check "outsider callerIsAdmin false"    ct-outsider "(false)"        callerIsAdmin

echo
echo "RESULT: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
