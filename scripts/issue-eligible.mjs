#!/usr/bin/env node
// Turn "milestones complete" into issued credentials.
//
//   node scripts/issue-eligible.mjs <cohort>            # dry run, shows who qualifies
//   node scripts/issue-eligible.mjs <cohort> --issue    # actually issue
//
// Eligibility is judged against the rule held ON CHAIN by `ops`, not against
// anything in the store. That is the point of putting rules on chain: the store
// says what someone did, the chain says what was required — permanently, and
// without trusting whoever runs the store.
//
// Personal data stays in the store. Only a digest reaches the chain.
import { execFileSync } from "node:child_process";
import { openStore, eligibility } from "../store/index.mjs";

const ENV = "local", IDENT = process.env.IDENTITY ?? "ct-admin-a";
const [cohort, ...flags] = process.argv.slice(2);
const doIssue = flags.includes("--issue");
if (!cohort) { console.error("usage: issue-eligible.mjs <cohort> [--issue]"); process.exit(2); }

const icp = (canister, method, args) => {
  try {
    return execFileSync("icp", ["canister", "call", canister, method, args, "-e", ENV, "--identity", IDENT],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, DO_NOT_TRACK: "1" } }).trim();
  } catch (e) { return ((e.stdout || "") + (e.stderr || "")).trim(); }
};

/// Read the on-chain rule for a role. Parsed from Candid text rather than a
/// generated binding, to keep this script dependency-free.
function onChainRule(role) {
  const out = icp("ops", "completionRule", `("${cohort}", "${role}")`).replace(/\s+/g, " ");
  if (out.includes("(null)")) return null;
  const vec = out.match(/requiredMilestones = vec \{([^}]*)\}/)?.[1] ?? "";
  const requiredMilestones = [...vec.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return { requiredMilestones };
}

const cohortState = icp("ops", "getCohort", `("${cohort}")`).replace(/\s+/g, " ");
if (cohortState.includes("(null)")) { console.error(`no such cohort on chain: ${cohort}`); process.exit(1); }
const closed = cohortState.includes("variant { closed }");

const store = await openStore();
const participants = await store.list(cohort);

console.log(`cohort   : ${cohort} (${closed ? "closed" : "open"})`);
console.log(`store    : ${store.name}`);
console.log(`people   : ${participants.length}`);
console.log(`mode     : ${doIssue ? "ISSUE" : "dry run — pass --issue to write"}\n`);

const ruleCache = new Map();
let eligible = 0, issued = 0, skipped = 0;

for (const p of participants) {
  if (!ruleCache.has(p.role)) ruleCache.set(p.role, onChainRule(p.role));
  const rule = ruleCache.get(p.role);
  const e = eligibility(p, rule);

  // Never print the email — this output gets pasted into chats and tickets.
  const who = `${p.participantId} (${p.holder}, ${p.role})`;
  if (!e.eligible) {
    skipped++;
    console.log(`  skip     ${who}\n           ${e.reason}${e.missing.length ? `: ${e.missing.join(", ")}` : ""}`);
    continue;
  }
  eligible++;
  if (!doIssue) { console.log(`  ELIGIBLE ${who}`); continue; }

  const out = execFileSync("node", ["scripts/issue-credential.mjs", "issue", p.holder, p.cohort, p.role],
    { encoding: "utf8", env: { ...process.env, DO_NOT_TRACK: "1" } });
  const credentialId = out.match(/credentials\/([0-9a-f]+)\.json/)?.[1];
  if (!credentialId) { console.log(`  FAILED   ${who}\n${out}`); continue; }
  // Write back so a re-run does not issue twice. The registry refusing a
  // duplicate digest is the second layer; neither is trusted alone.
  await store.markIssued(p.participantId, credentialId);
  issued++;
  console.log(`  ISSUED   ${who}\n           credential ${credentialId}`);
}

console.log(`\n${eligible} eligible, ${issued} issued, ${skipped} skipped`);
