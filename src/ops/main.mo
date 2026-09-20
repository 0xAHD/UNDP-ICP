import Set "mo:core/Set";
import Principal "mo:core/Principal";
import AdminApi "mixins/Admin";

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

  include AdminApi(admins);
};
