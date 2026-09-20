import Set "mo:core/Set";
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
  type NewActor = {
    admins : Set.Set<Principal>;
    bootstrap : { var closed : Bool };
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
      schema = 2;
    };
  };
};
