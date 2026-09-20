import Set "mo:core/Set";
import Principal "mo:core/Principal";

/// Introduces registry stable state.
///
/// Self-contained by rule: only `mo:core` imports, both actor shapes inlined.
/// Never edit or rename this file once it has been deployed.
///
/// `admins` starts empty; a canister controller seeds it via `bootstrapAdmin`
/// until the two-admin floor is met, after which the set governs itself.
module {
  type OldActor = {};
  type NewActor = { admins : Set.Set<Principal> };

  public func migration(_old : OldActor) : NewActor {
    { admins = Set.empty() };
  };
};
