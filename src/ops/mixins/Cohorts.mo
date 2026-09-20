import Map "mo:core/Map";
import Text "mo:core/Text";
import Set "mo:core/Set";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Types "../types";
import Cohorts "../lib/Cohorts";

/// Cohort and completion-rule endpoints.
///
/// Writes are admin-only and reject the anonymous principal. Reads are open:
/// this is policy, not people (claude/personal-data-on-chain.md §5a), and a
/// verifier benefits from seeing the standard that applied.
mixin (
  admins : Set.Set<Principal>,
  cohorts : Map.Map<Types.Slug, Types.Cohort>,
  rules : Types.Rules,
) {

  /// Open a cohort. `id` must be a valid slug — see `lib/Slug.mo`.
  public shared ({ caller }) func openCohort(
    id : Types.Slug
  ) : async Result.Result<(), Types.CohortError> {
    Cohorts.openCohort(admins, cohorts, caller, id);
  };

  /// Close a cohort, freezing its rules permanently. There is no reopen.
  public shared ({ caller }) func closeCohort(
    id : Types.Slug
  ) : async Result.Result<(), Types.CohortError> {
    Cohorts.closeCohort(admins, cohorts, caller, id);
  };

  /// Set what a role must complete in an OPEN cohort.
  public shared ({ caller }) func setCompletionRule(
    cohort : Types.Slug,
    role : Types.Slug,
    requiredMilestones : [Types.Slug],
  ) : async Result.Result<(), Types.RuleError> {
    Cohorts.setRule(admins, cohorts, rules, caller, cohort, role, requiredMilestones);
  };

  public query func getCohort(id : Types.Slug) : async ?Types.Cohort {
    Cohorts.get(cohorts, id);
  };

  public query func listCohorts() : async [Types.Cohort] {
    Cohorts.list(cohorts);
  };

  /// Every rule for a cohort — the full standard that applied.
  public query func completionRules(cohort : Types.Slug) : async [Types.Rule] {
    Cohorts.rulesFor(rules, cohort);
  };

  public query func completionRule(
    cohort : Types.Slug,
    role : Types.Slug,
  ) : async ?Types.Rule {
    Cohorts.rule(rules, cohort, role);
  };

  /// The cap on milestones per rule, so callers can check before submitting.
  public query func maxMilestones() : async Nat {
    Cohorts.maxMilestones;
  };
};
