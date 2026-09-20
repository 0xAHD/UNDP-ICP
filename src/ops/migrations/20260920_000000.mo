import Set "mo:core/Set";
import Principal "mo:core/Principal";

/// Introduces ops stable state.
///
/// Self-contained by rule: only `mo:core` imports, both actor shapes inlined.
/// Never edit or rename this file once it has been deployed.
module {
  type OldActor = {};
  type NewActor = { admins : Set.Set<Principal> };

  public func migration(_old : OldActor) : NewActor {
    { admins = Set.empty() };
  };
};
