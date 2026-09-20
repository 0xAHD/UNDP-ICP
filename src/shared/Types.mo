/// Access-control types shared by every Cohort Tracker canister.
///
/// STORAGE RULE (see CLAUDE.md): every type reachable from canister state is
/// PUBLIC and PERMANENT. Nothing here may carry a name, an email, free text,
/// an evidence URL, or financial data — only principals and categorical tags.
module {

  /// Latch recording that bootstrap has finished.
  ///
  /// This is stable state rather than a condition derived from the admin count,
  /// because "bootstrap closes permanently" must stay true even if the admin
  /// floor is later RAISED — a derived check would silently reopen a
  /// controller-only path to the admin set. Once `closed` is true it is never
  /// set back to false.
  public type BootstrapState = {
    var closed : Bool;
  };

  /// Why an access-controlled call was refused.
  ///
  /// Returned rather than trapped so that callers get a typed, testable
  /// refusal instead of a canister trap.
  public type AccessError = {
    /// The anonymous principal (`2vxsx-fae`) called an authenticated method.
    #anonymousCaller;
    /// The anonymous principal was offered as the TARGET of an admin change.
    /// Distinct from `#anonymousCaller` so the two cannot be confused.
    #anonymousTarget;
    /// Caller is authenticated but is not an admin (or not a controller,
    /// for bootstrap).
    #notAuthorized;
    /// Target principal is already in the admin set.
    #alreadyAdmin;
    /// Target principal is not in the admin set.
    #unknownAdmin;
    /// Removing this principal would drop the admin set below its floor.
    #adminFloor;
    /// Bootstrap has latched shut. This is permanent.
    #bootstrapClosed;
  };
};
