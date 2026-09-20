import Set "mo:core/Set";
import Map "mo:core/Map";
import Principal "mo:core/Principal";

/// Initial stable shape.
///
/// PRE-LIVE: this file is still editable. Until the canister is deployed to a
/// real environment, fold every schema change into THIS file and reset local
/// state (`./scripts/dev.sh reset`) rather than stacking new migrations — a
/// shorter chain replays faster forever and leaves nothing frozen by mistake.
///
/// AT GO-LIVE this file freezes permanently: never edit or rename it again,
/// and add a new timestamped migration for each subsequent change.
/// See CLAUDE.md, "Iterating before go-live".
///
/// Self-contained by rule: only `mo:core` imports, both actor shapes inlined.
module {
  type OldActor = {};
  // Inlined by rule: migrations import only mo:core, never ../types.
  type Slug = Text;
  type Date = Nat;
  type CohortStatus = { #open; #closed };
  type Cohort = {
    id : Slug;
    status : CohortStatus;
    openedAt : Date;
    closedAt : ?Date;
  };
  type Rule = { role : Slug; requiredMilestones : [Slug]; setAt : Date };

  type NewActor = {
    admins : Set.Set<Principal>;
    bootstrap : { var closed : Bool };
    cohorts : Map.Map<Slug, Cohort>;
    rules : Map.Map<Slug, Map.Map<Slug, Rule>>;
    schema : Nat;
  };

  public func migration(_old : OldActor) : NewActor {
    {
      // Starts empty; a controller seeds it via `bootstrapAdmin` until the
      // admin floor is met, after which bootstrap closes permanently.
      admins = Set.empty();
      // Bootstrap latch. Starts open; closes for good once the admin floor
      // is reached. Never reset to false.
      bootstrap = { var closed = false };
      // Bump whenever the stable shape above changes.
      cohorts = Map.empty();
      rules = Map.empty();
      schema = 3;
    };
  };
};
