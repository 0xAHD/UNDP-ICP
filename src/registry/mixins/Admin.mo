import Set "mo:core/Set";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Admin "../lib/Admin";
import Types "../types";

/// Registry governance endpoints.
///
/// Every state-changing method rejects the anonymous principal and requires an
/// existing admin. Refusals are returned as `#err`, not trapped, so callers and
/// tests can match on the reason.
mixin (admins : Set.Set<Principal>) {

  /// Seed the admin set. Controller-only, and only until the two-admin floor
  /// is reached — after that this returns `#bootstrapClosed` forever.
  public shared ({ caller }) func bootstrapAdmin(
    who : Principal
  ) : async Result.Result<(), Types.AccessError> {
    Admin.bootstrapAdmin(admins, caller, who);
  };

  /// Admit a new admin. Requires an existing admin.
  public shared ({ caller }) func addAdmin(
    who : Principal
  ) : async Result.Result<(), Types.AccessError> {
    Admin.addAdmin(admins, caller, who);
  };

  /// Remove an admin, never dropping below the two-admin floor.
  public shared ({ caller }) func removeAdmin(
    who : Principal
  ) : async Result.Result<(), Types.AccessError> {
    Admin.removeAdmin(admins, caller, who);
  };

  /// The current admin set. Public by design: these are governance
  /// principals, not participant data.
  public query func listAdmins() : async [Principal] {
    admins.toArray();
  };

  /// Number of principals currently holding admin rights.
  public query func adminCount() : async Nat {
    admins.size();
  };

  /// The floor this canister enforces.
  public query func adminFloor() : async Nat {
    Admin.floor;
  };

  /// Whether the calling principal holds admin rights.
  public query ({ caller }) func callerIsAdmin() : async Bool {
    Admin.isAdmin(admins, caller);
  };
};
