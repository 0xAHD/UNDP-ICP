#!/usr/bin/env bash
# Cohorts and completion rules on `ops`. LOCAL ONLY.
# Expects a fresh deploy with admins seeded to the floor.
#
# The section that matters most is "free text cannot get in": the storage rule
# is only real if the code enforces it.
set -uo pipefail
cd "$(dirname "$0")/.."
export DO_NOT_TRACK=1
ENV_NAME=local; CAN=ops; PASS=0; FAIL=0

check() {
  local label="$1" id="$2" want="$3" method="$4" args="${5:-()}" got
  # Records print across several lines, so collapse the whole reply rather
  # than taking the last line (which would just be the closing paren).
  got=$(timeout 120 icp canister call "$CAN" "$method" "$args" \
          -e "$ENV_NAME" --identity "$id" </dev/null 2>&1 \
        | tr '\n' ' ' | tr -s ' ' | sed 's/ *$//')
  if [[ "$got" == *"$want"* ]]; then
    printf '  PASS  %-46s %.72s\n' "$label" "$got"; PASS=$((PASS+1))
  else
    printf '  FAIL  %-46s got:%s want:%s\n' "$label" "$got" "$want"; FAIL=$((FAIL+1))
  fi
}

echo "CANISTER: $CAN -> $(icp canister status "$CAN" -e "$ENV_NAME" --identity ct-admin-a 2>/dev/null | awk '/Canister Id:/{print $3; exit}')"
echo

echo "-- writes are admin-only --"
check "anon openCohort"                anonymous   "anonymousCaller" openCohort '("altfinlab-2026")'
check "non-admin openCohort"           ct-outsider "notAuthorized"   openCohort '("altfinlab-2026")'
check "anon setCompletionRule"         anonymous   "anonymousCaller" setCompletionRule '("altfinlab-2026", "founder", vec {})'

echo
echo "-- free text cannot get in (the storage rule, enforced) --"
check "a person's name rejected"       ct-admin-a "invalidIdentifier" openCohort '("Amina Yusuf")'
check "an email rejected"              ct-admin-a "invalidIdentifier" openCohort '("amina@example.org")'
check "a sentence rejected"            ct-admin-a "invalidIdentifier" openCohort '("completed the programme well")'
check "uppercase rejected"             ct-admin-a "invalidIdentifier" openCohort '("AltFinLab")'
check "empty rejected"                 ct-admin-a "invalidIdentifier" openCohort '("")'
check "33 chars rejected"              ct-admin-a "invalidIdentifier" openCohort '("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")'
check "trailing hyphen rejected"       ct-admin-a "invalidIdentifier" openCohort '("cohort-")'
check "32 chars accepted (boundary)"   ct-admin-a "ok"                openCohort '("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")'

echo
echo "-- cohorts --"
check "admin opens a cohort"           ct-admin-a "ok"              openCohort '("altfinlab-2026")'
check "duplicate cohort refused"       ct-admin-a "duplicateCohort" openCohort '("altfinlab-2026")'
check "cohort is readable"             anonymous  "opened"          getCohort  '("altfinlab-2026")'
check "unknown cohort is null"         anonymous  "(null)"          getCohort  '("no-such-cohort")'

echo
echo "-- completion rules --"
check "rule on unknown cohort"         ct-admin-a "unknownCohort"      setCompletionRule '("nope", "founder", vec {"a"})'
check "invalid milestone rejected"     ct-admin-a "invalidIdentifier"  setCompletionRule '("altfinlab-2026", "founder", vec {"Pitch Night"})'
check "duplicate milestone rejected"   ct-admin-a "duplicateMilestone" setCompletionRule '("altfinlab-2026", "founder", vec {"a"; "a"})'
check "admin sets a rule"              ct-admin-a "ok"                 setCompletionRule '("altfinlab-2026", "founder", vec {"pitch-training"; "demo-day"})'
check "rule is readable"               anonymous  "demo-day"           completionRule '("altfinlab-2026", "founder")'
check "second role"                    ct-admin-a "ok"                 setCompletionRule '("altfinlab-2026", "mentor", vec {"office-hours"})'
check "both rules listed"              anonymous  "office-hours"       completionRules '("altfinlab-2026")'
check "maxMilestones exposed"          anonymous  "(32 : nat)"         maxMilestones

echo
echo "-- closing freezes the standard permanently --"
check "admin closes the cohort"        ct-admin-a "ok"           closeCohort '("altfinlab-2026")'
check "double close refused"           ct-admin-a "alreadyClosed" closeCohort '("altfinlab-2026")'
check "rules FROZEN after close"       ct-admin-a "cohortClosed" setCompletionRule '("altfinlab-2026", "founder", vec {"rewritten"})'
check "closed cohort still readable"   anonymous  "closed"       getCohort '("altfinlab-2026")'
check "frozen rule is unchanged"       anonymous  "pitch-training" completionRule '("altfinlab-2026", "founder")'

echo
echo "RESULT: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
