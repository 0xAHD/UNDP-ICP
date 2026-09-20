import Set "mo:core/Set";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Access "../../shared/Access";
import Types "../types";

/// Ops admin policy.
///
/// Mirrors the registry's two-admin floor as a scaffold default. Unlike the
/// registry's floor — which is a hard rule tied to the credential DID — this
/// value is a placeholder pending the accelerator-ops governance decision.
module {

  /// Scaffold default; confirm before first engine deploy.
  public let floor : Nat = 2;

  public func isAdmin(admins : Set.Set<Principal>, who : Principal) : Bool {
    Access.isAdmin(admins, who);
  };

  public func requireAdmin(
    admins : Set.Set<Principal>,
    caller : Principal,
  ) : Result.Result<(), Types.AccessError> {
    Access.requireAdmin(admins, caller);
  };

  public func bootstrapAdmin(
    admins : Set.Set<Principal>,
    caller : Principal,
    who : Principal,
  ) : Result.Result<(), Types.AccessError> {
    Access.bootstrapAdmin(admins, caller, who, floor);
  };

  public func addAdmin(
    admins : Set.Set<Principal>,
    caller : Principal,
    who : Principal,
  ) : Result.Result<(), Types.AccessError> {
    Access.addAdmin(admins, caller, who);
  };

  public func removeAdmin(
    admins : Set.Set<Principal>,
    caller : Principal,
    who : Principal,
  ) : Result.Result<(), Types.AccessError> {
    Access.removeAdmin(admins, caller, who, floor);
  };
};
