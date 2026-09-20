#!/usr/bin/env node
// Store + eligibility suite. Runs against the local adapter and the real
// on-chain rules, so the logic that decides who gets a credential is tested
// even though no tenant credentials exist yet.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { openStore, eligibility } from "../store/index.mjs";

const ENV = "local", IDENT = "ct-admin-a";
let pass = 0, fail = 0;
const check = (label, got, want) => {
  const ok = String(got) === String(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(46)} ${ok ? "" : `got:${got} want:${want}`}`);
  ok ? pass++ : fail++;
};
const icp = (c, m, a) => {
  try {
    return execFileSync("icp", ["canister", "call", c, m, a, "-e", ENV, "--identity", IDENT],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, DO_NOT_TRACK: "1" } }).trim();
  } catch (e) { return ((e.stdout || "") + (e.stderr || "")).trim(); }
};

// --- on-chain policy the store is judged against --------------------------
const COHORT = "store-test-2026";
icp("ops", "openCohort", `("${COHORT}")`);
icp("ops", "setCompletionRule", `("${COHORT}", "founder", vec {"pitch-training"; "demo-day"})`);
icp("ops", "setCompletionRule", `("${COHORT}", "mentor", vec {"office-hours"})`);

const rule = (role) => {
  const out = icp("ops", "completionRule", `("${COHORT}", "${role}")`).replace(/\s+/g, " ");
  if (out.includes("(null)")) return null;
  const vec = out.match(/requiredMilestones = vec \{([^}]*)\}/)?.[1] ?? "";
  return { requiredMilestones: [...vec.matchAll(/"([^"]+)"/g)].map((m) => m[1]) };
};

console.log("-- on-chain rules are readable --");
check("founder rule has 2 milestones", rule("founder")?.requiredMilestones.length, 2);
check("mentor rule has 1 milestone", rule("mentor")?.requiredMilestones.length, 1);
check("unknown role has no rule", rule("nobody"), null);

// --- the store ------------------------------------------------------------
const FILE = "/tmp/store-test-participants.json";
fs.rmSync(FILE, { force: true });
const store = await openStore("local", { path: FILE });
await store.seed([
  { participantId: "p-001", holder: "Amina Yusuf", email: "amina@example.org",
    cohort: COHORT, role: "founder", milestones: ["pitch-training", "demo-day"] },
  { participantId: "p-002", holder: "Kwame Mensah", email: "kwame@example.org",
    cohort: COHORT, role: "founder", milestones: ["pitch-training"] },
  { participantId: "p-003", holder: "Lena Park", email: "lena@example.org",
    cohort: COHORT, role: "mentor", milestones: ["office-hours"] },
  { participantId: "p-004", holder: "Sam Okoro", email: "sam@example.org",
    cohort: COHORT, role: "ghost", milestones: ["office-hours"] },
  { participantId: "p-005", holder: "Prior Issue", email: "prior@example.org",
    cohort: COHORT, role: "mentor", milestones: ["office-hours"], credentialId: "deadbeef" },
  { participantId: "p-900", holder: "Other Cohort", email: "other@example.org",
    cohort: "someone-else", role: "founder", milestones: ["pitch-training", "demo-day"] },
]);

console.log("\n-- the store --");
check("lists only the asked-for cohort", (await store.list(COHORT)).length, 5);
check("get by id works", (await store.get("p-001"))?.holder, "Amina Yusuf");
check("unknown id is null", await store.get("p-nope"), null);

console.log("\n-- eligibility, judged against the CHAIN --");
const people = Object.fromEntries((await store.list(COHORT)).map((p) => [p.participantId, p]));
check("all milestones done -> eligible", eligibility(people["p-001"], rule("founder")).eligible, true);
check("one missing -> not eligible", eligibility(people["p-002"], rule("founder")).eligible, false);
check("names the missing milestone", eligibility(people["p-002"], rule("founder")).missing.join(), "demo-day");
check("different role, own rule", eligibility(people["p-003"], rule("mentor")).eligible, true);
check("role with no on-chain rule", eligibility(people["p-004"], rule("ghost")).eligible, false);
check("already issued -> not again", eligibility(people["p-005"], rule("mentor")).eligible, false);
check("already issued says why", eligibility(people["p-005"], rule("mentor")).reason, "already issued");

// A participant cannot qualify by doing EXTRA things that were not required.
const extra = { ...people["p-002"], milestones: ["pitch-training", "unrelated", "another"] };
check("extra milestones do not substitute", eligibility(extra, rule("founder")).eligible, false);

console.log("\n-- idempotence --");
await store.markIssued("p-001", "abc123");
check("markIssued persists", (await store.get("p-001"))?.credentialId, "abc123");
check("re-run would skip it", eligibility(await store.get("p-001"), rule("founder")).eligible, false);

fs.rmSync(FILE, { force: true });
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
