import Set "mo:core/Set";
import Principal "mo:core/Principal";
import SharedTypes "../shared/Types";
import Map "mo:core/Map";
import Text "mo:core/Text";
import Types "types";
import AdminApi "mixins/Admin";
import MetaApi "mixins/Meta";
import CohortsApi "mixins/Cohorts";

/// UNDP AltFinLab Cohort Tracker — `ops` canister.
///
/// Internal accelerator-ops state. Holds NO participant-identifying data:
/// names, emails, evidence URLs and funding notes belong in the off-chain
/// store. See CLAUDE.md.
///
/// Composition root only — no public methods are declared here; endpoints come
/// from the mixins. Stable fields are declared with types only; their initial
/// values come from the migration chain in `migrations/`.
persistent actor {

  /// Principals permitted to administer ops.
  let admins : Set.Set<Principal>;

  /// Stable-shape version, supplied by the migration chain.
  /// Named `schema` because `include` injects mixin names into this same
  /// scope, and the Meta mixin exposes a `schemaVersion` query.
  /// Latch recording that bootstrap has finished. See shared/Types.mo.
  let bootstrap : SharedTypes.BootstrapState;

  /// Cohorts and their per-role completion rules. POLICY ONLY — this canister
  /// holds no participant-level data on chain at all, by decision. See
  /// claude/personal-data-on-chain.md §5a.
  let cohorts : Map.Map<Types.Slug, Types.Cohort>;
  let rules : Types.Rules;

  let schema : Nat;

  include AdminApi(admins, bootstrap);
  include MetaApi(schema);
  include CohortsApi(admins, cohorts, rules);
};
