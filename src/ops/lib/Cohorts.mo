import Map "mo:core/Map";
import Iter "mo:core/Iter";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Set "mo:core/Set";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Time "mo:core/Time";
import Int "mo:core/Int";
import Types "../types";
import Admin "Admin";
import Slug "Slug";

/// Cohorts and their per-role completion rules. POLICY ONLY — no participant
/// data passes through this module (claude/personal-data-on-chain.md §5a).
///
/// Rules are mutable while a cohort is open and frozen the moment it closes.
/// That is the property that makes putting them on chain worthwhile: a
/// credential issued against a closed cohort can always be checked against the
/// rules that actually applied, and nobody can revise the standard afterwards.
///
/// Every function is synchronous — no `await`, so no TOCTOU surface.
module {

  /// Bounds caller-created state (canister-security pitfall 10).
  public let maxMilestones : Nat = 32;

  let nanosPerDay : Nat = 86_400_000_000_000;

  /// Canister-computed so no caller can backdate a cohort.
  public func today() : Types.Date {
    Int.abs(Time.now()) / nanosPerDay;
  };

  // --- reads (public, unauthenticated by design) ---------------------------

  public func get(cohorts : Map.Map<Types.Slug, Types.Cohort>, id : Types.Slug) : ?Types.Cohort {
    cohorts.get(id);
  };

  public func list(cohorts : Map.Map<Types.Slug, Types.Cohort>) : [Types.Cohort] {
    cohorts.values().toArray();
  };

  public func rulesFor(rules : Types.Rules, cohort : Types.Slug) : [Types.Rule] {
    switch (rules.get(cohort)) {
      case null { [] };
      case (?byRole) { byRole.values().toArray() };
    };
  };

  public func rule(rules : Types.Rules, cohort : Types.Slug, role : Types.Slug) : ?Types.Rule {
    switch (rules.get(cohort)) {
      case null { null };
      case (?byRole) { byRole.get(role) };
    };
  };

  // --- writes (admin only) --------------------------------------------------

  public func openCohort(
    admins : Set.Set<Principal>,
    cohorts : Map.Map<Types.Slug, Types.Cohort>,
    caller : Principal,
    id : Types.Slug,
  ) : Result.Result<(), Types.CohortError> {
    switch (Admin.requireAdmin(admins, caller)) {
      case (#err(#anonymousCaller)) { return #err(#anonymousCaller) };
      case (#err _) { return #err(#notAuthorized) };
      case (#ok) {};
    };
    if (not Slug.isValid(id)) { return #err(#invalidIdentifier) };
    if (cohorts.containsKey(id)) { return #err(#duplicateCohort) };
    cohorts.add(id, { id; status = #open; openedAt = today(); closedAt = null });
    #ok;
  };

  /// Close a cohort, freezing its rules permanently. There is deliberately no
  /// reopen: reopening would let the standard be revised after credentials
  /// were issued against it, which is the whole thing this prevents.
  public func closeCohort(
    admins : Set.Set<Principal>,
    cohorts : Map.Map<Types.Slug, Types.Cohort>,
    caller : Principal,
    id : Types.Slug,
  ) : Result.Result<(), Types.CohortError> {
    switch (Admin.requireAdmin(admins, caller)) {
      case (#err(#anonymousCaller)) { return #err(#anonymousCaller) };
      case (#err _) { return #err(#notAuthorized) };
      case (#ok) {};
    };
    if (not Slug.isValid(id)) { return #err(#invalidIdentifier) };
    switch (cohorts.get(id)) {
      case null { #err(#unknownCohort) };
      case (?c) {
        switch (c.status) {
          case (#closed) { #err(#alreadyClosed) };
          case (#open) {
            let day = today();
            cohorts.add(id, { c with status = #closed; closedAt = ?day });
            #ok;
          };
        };
      };
    };
  };

  /// Set (or replace) the completion rule for one role in an OPEN cohort.
  public func setRule(
    admins : Set.Set<Principal>,
    cohorts : Map.Map<Types.Slug, Types.Cohort>,
    rules : Types.Rules,
    caller : Principal,
    cohort : Types.Slug,
    role : Types.Slug,
    requiredMilestones : [Types.Slug],
  ) : Result.Result<(), Types.RuleError> {
    switch (Admin.requireAdmin(admins, caller)) {
      case (#err(#anonymousCaller)) { return #err(#anonymousCaller) };
      case (#err _) { return #err(#notAuthorized) };
      case (#ok) {};
    };
    if (not Slug.isValid(cohort) or not Slug.isValid(role)) {
      return #err(#invalidIdentifier);
    };
    if (requiredMilestones.size() > maxMilestones) { return #err(#tooManyMilestones) };
    // Validity and distinctness are checked together: a repeated milestone is
    // a caller mistake, and silently de-duplicating would hide it.
    for (m in requiredMilestones.values()) {
      if (not Slug.isValid(m)) { return #err(#invalidIdentifier) };
    };
    if (not Slug.allValidAndDistinct(requiredMilestones)) {
      return #err(#duplicateMilestone);
    };
    switch (cohorts.get(cohort)) {
      case null { return #err(#unknownCohort) };
      case (?c) {
        switch (c.status) {
          case (#closed) { return #err(#cohortClosed) };
          case (#open) {};
        };
      };
    };
    let byRole = switch (rules.get(cohort)) {
      case (?m) { m };
      case null {
        let fresh = Map.empty<Types.Slug, Types.Rule>();
        rules.add(cohort, fresh);
        fresh;
      };
    };
    byRole.add(role, { role; requiredMilestones; setAt = today() });
    #ok;
  };
};
