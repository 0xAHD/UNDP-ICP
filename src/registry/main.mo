import Set "mo:core/Set";
import Principal "mo:core/Principal";
import AdminApi "mixins/Admin";
import MetaApi "mixins/Meta";

/// UNDP AltFinLab Cohort Tracker — `registry` canister.
///
/// THIS CANISTER'S PRINCIPAL IS THE CREDENTIAL DID, PERMANENTLY.
/// Never reinstall, delete, or recreate it. `.icp/data/` holds the name-to-ID
/// mapping and must stay committed. See CLAUDE.md.
///
/// Composition root only — no public methods are declared here; endpoints come
/// from the mixins. Stable fields are declared with types only; their initial
/// values come from the migration chain in `migrations/`.
persistent actor {

  /// Principals permitted to administer the registry.
  /// Governance state only — this canister holds no participant data.
  let admins : Set.Set<Principal>;

  /// Stable-shape version, supplied by the migration chain.
  /// Named `schema` because `include` injects mixin names into this same
  /// scope, and the Meta mixin exposes a `schemaVersion` query.
  let schema : Nat;

  include AdminApi(admins);
  include MetaApi(schema);
};
