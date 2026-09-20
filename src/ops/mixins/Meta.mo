/// Build/schema introspection for the `ops` canister.
///
/// Holds no participant data. Exists so that during iteration you can tell
/// which schema a running canister is on without reading its state.
mixin (version : Nat) {

  /// Schema version, set by the migration chain in `migrations/`.
  /// Bump it in the migration whenever the stable shape changes.
  public query func schemaVersion() : async Nat {
    version;
  };
};
