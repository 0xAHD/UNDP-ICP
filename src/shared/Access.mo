import Set "mo:core/Set";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Types "Types";

/// Admin-set access control, shared by the `ops` and `registry` canisters.
///
/// The admin floor is a *parameter* here rather than a constant: each canister
/// states its own floor in its `lib/Admin.mo`. The registry's floor is 2 and is
/// a hard rule (see CLAUDE.md) — this module must never be changed in a way
/// that lets an admin set shrink past the floor it was given.
module {

  /// Reject the anonymous principal. Every authenticated entry point starts
  /// here — an unauthenticated caller must never reach state.
  public func requireAuthenticated(caller : Principal) : Result.Result<(), Types.AccessError> {
    if (caller.isAnonymous()) #err(#anonymousCaller) else #ok;
  };

  /// True when `who` currently holds admin rights.
  public func isAdmin(admins : Set.Set<Principal>, who : Principal) : Bool {
    admins.contains(who);
  };

  /// Guard for every state-changing method: authenticated AND an admin.
  public func requireAdmin(
    admins : Set.Set<Principal>,
    caller : Principal,
  ) : Result.Result<(), Types.AccessError> {
    switch (requireAuthenticated(caller)) {
      case (#err e) { return #err(e) };
      case (#ok) {};
    };
    if (admins.contains(caller)) #ok else #err(#notAuthorized);
  };

  /// Seed the admin set before it can govern itself.
  ///
  /// Callable only by a canister *controller*, and only until the latch in
  /// `bootstrap` closes. Reaching `floor` sets that latch, permanently; from
  /// then on the admins manage each other via `addAdmin` / `removeAdmin`.
  ///
  /// NOTE: this constrains admins, not controllers. A controller can upgrade
  /// or reinstall the canister and bypass every rule here — see CLAUDE.md §11.
  public func bootstrapAdmin(
    admins : Set.Set<Principal>,
    bootstrap : Types.BootstrapState,
    caller : Principal,
    who : Principal,
    floor : Nat,
  ) : Result.Result<(), Types.AccessError> {
    switch (requireAuthenticated(caller)) {
      case (#err e) { return #err(e) };
      case (#ok) {};
    };
    if (not caller.isController()) { return #err(#notAuthorized) };
    // Read the LATCH, not `admins.size() >= floor`. A derived check would
    // reopen this path if the floor were ever raised after go-live.
    if (bootstrap.closed) { return #err(#bootstrapClosed) };
    if (who.isAnonymous()) { return #err(#anonymousTarget) };
    if (admins.contains(who)) { return #err(#alreadyAdmin) };
    admins.add(who);
    if (admins.size() >= floor) { bootstrap.closed := true };
    #ok;
  };

  /// Admit a new admin. Requires an existing admin as caller.
  public func addAdmin(
    admins : Set.Set<Principal>,
    caller : Principal,
    who : Principal,
  ) : Result.Result<(), Types.AccessError> {
    switch (requireAdmin(admins, caller)) {
      case (#err e) { return #err(e) };
      case (#ok) {};
    };
    if (who.isAnonymous()) { return #err(#anonymousTarget) };
    if (admins.contains(who)) { return #err(#alreadyAdmin) };
    admins.add(who);
    #ok;
  };

  /// Remove an admin, never dropping the set below `floor`.
  public func removeAdmin(
    admins : Set.Set<Principal>,
    caller : Principal,
    who : Principal,
    floor : Nat,
  ) : Result.Result<(), Types.AccessError> {
    switch (requireAdmin(admins, caller)) {
      case (#err e) { return #err(e) };
      case (#ok) {};
    };
    if (not admins.contains(who)) { return #err(#unknownAdmin) };
    if (admins.size() <= floor) { return #err(#adminFloor) };
    admins.remove(who);
    #ok;
  };
};
