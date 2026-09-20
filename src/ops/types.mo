import Map "mo:core/Map";
import Access "../shared/Types";

/// `ops` canister types.
///
/// STORAGE RULE (claude/personal-data-on-chain.md §5a — DECIDED): `ops` holds
/// **no participant-level data on chain at all**, not even a pseudonymous
/// participant ID. Pseudonymised data is still personal data, an accelerator
/// cohort is small enough that `cohort + role + status + date` is often unique
/// to one person, and nothing about internal operations needs a public
/// permanent ledger.
///
/// What IS here is POLICY, not people: which cohorts exist, and what each role
/// had to complete. That is worth putting on chain — a verifier can see the
/// standard that applied when a credential was issued, without trusting us.
///
/// Participant progress lives entirely off chain. Adding it here later would
/// need a UNDP data-protection ruling AND a k-anonymity assessment.
module {

  public type AccessError = Access.AccessError;

  /// A validated categorical identifier: lowercase `a-z`, digits, hyphen,
  /// 1..32 chars, no leading/trailing hyphen. Enforced by `lib/Slug.mo` on
  /// every write — see that module for why this is a type-level concern.
  public type Slug = Text;

  /// Days since the Unix epoch. Canister-computed, never caller-supplied.
  public type Date = Nat;

  public type CohortStatus = {
    /// Rules may still be set.
    #open;
    /// Rules are frozen permanently. A credential issued against this cohort
    /// can always be checked against the rules that actually applied.
    #closed;
  };

  public type Cohort = {
    id : Slug;
    status : CohortStatus;
    openedAt : Date;
    closedAt : ?Date;
  };

  /// What a given role had to complete in a given cohort.
  public type Rule = {
    role : Slug;
    requiredMilestones : [Slug];
    setAt : Date;
  };

  /// cohort -> role -> rule. Nested rather than a composite key so there is no
  /// delimiter to escape, and so a cohort's rules can be read as one unit.
  public type Rules = Map.Map<Slug, Map.Map<Slug, Rule>>;

  public type CohortError = {
    #anonymousCaller;
    #notAuthorized;
    /// Identifier is not a valid slug. Deliberately carries no payload: the
    /// rejected value is unvalidated caller input and is not echoed back.
    #invalidIdentifier;
    #duplicateCohort;
    #unknownCohort;
    /// The cohort is closed; its rules are frozen permanently.
    #cohortClosed;
    #alreadyClosed;
  };

  public type RuleError = {
    #anonymousCaller;
    #notAuthorized;
    #invalidIdentifier;
    #unknownCohort;
    #cohortClosed;
    /// Bounds the state a caller can create — canister-security pitfall 10.
    #tooManyMilestones;
    /// A milestone listed twice, or two milestones that are not distinct.
    #duplicateMilestone;
  };
};
