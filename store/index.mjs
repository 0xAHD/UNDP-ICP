// Participant store — the OFF-CHAIN half of the system.
//
// This is where personal data lives: names, emails, who completed what. None
// of it ever goes on chain (claude/personal-data-on-chain.md §5a). The chain
// holds policy — cohorts and completion rules — and credential digests.
//
// Everything behind one interface so the store is a config change, not a
// rewrite. Adapters:
//   local       JSON file. Dev and tests. Fully exercised by the suite.
//   sharepoint  Microsoft Graph list. The intended production store.
//   google      Google Sheets. Backup / fallback.
//
// A participant record:
//   { participantId, holder, email, cohort, role, milestones[], credentialId? }
//
// `credentialId` is written back once a credential is issued. It is the
// store-side half of idempotence; the registry refusing a duplicate digest is
// the other half, and neither is trusted alone.

/** @typedef {{participantId:string, holder:string, email?:string,
 *             cohort:string, role:string, milestones:string[],
 *             credentialId?:string}} Participant */

/**
 * Every adapter implements exactly this.
 * @typedef {{
 *   name: string,
 *   list: (cohort: string) => Promise<Participant[]>,
 *   get: (participantId: string) => Promise<Participant|null>,
 *   markIssued: (participantId: string, credentialId: string) => Promise<void>,
 * }} Store
 */

/** Pick an adapter from STORE (default: local). */
export async function openStore(kind = process.env.STORE ?? "local", opts = {}) {
  switch (kind) {
    case "local": {
      const { LocalStore } = await import("./local.mjs");
      return new LocalStore(opts.path ?? process.env.STORE_PATH ?? "participants.json");
    }
    case "sharepoint": {
      const { SharePointStore } = await import("./sharepoint.mjs");
      return SharePointStore.fromEnv(opts);
    }
    case "google": {
      const { GoogleSheetStore } = await import("./google.mjs");
      return GoogleSheetStore.fromEnv(opts);
    }
    default:
      throw new Error(`unknown store: ${kind} (want local | sharepoint | google)`);
  }
}

/**
 * Is this participant eligible, judged against the ON-CHAIN rule?
 *
 * The rule comes from `ops`, not from the store — that is the point of putting
 * rules on chain. The store says what someone did; the chain says what was
 * required, permanently and without trusting whoever runs the store.
 *
 * @param {Participant} p
 * @param {{requiredMilestones:string[]}|null} rule
 */
export function eligibility(p, rule) {
  if (!rule) return { eligible: false, reason: "no on-chain rule for this cohort and role", missing: [] };
  if (p.credentialId) return { eligible: false, reason: "already issued", missing: [] };
  const done = new Set(p.milestones ?? []);
  const missing = rule.requiredMilestones.filter((m) => !done.has(m));
  return missing.length
    ? { eligible: false, reason: `missing ${missing.length} milestone(s)`, missing }
    : { eligible: true, reason: "all required milestones complete", missing: [] };
}
