import Set "mo:core/Set";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Access "../../shared/Access";
import SharedTypes "../../shared/Types";
import Types "../types";

/// Registry admin policy.
///
/// The registry carries a **two-admin floor**: it must never be reducible to a
/// single point of control, because this canister's principal is the credential
/// DID and its admin set authorises issuance. This constant is the hard rule;
/// the mechanics live in `shared/Access`.
module {

  /// The registry must always retain at least this many admins.
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
    bootstrap : SharedTypes.BootstrapState,
    caller : Principal,
    who : Principal,
  ) : Result.Result<(), Types.AccessError> {
    Access.bootstrapAdmin(admins, bootstrap, caller, who, floor);
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
