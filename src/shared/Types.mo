/// Access-control types shared by every Cohort Tracker canister.
///
/// STORAGE RULE (see CLAUDE.md): every type reachable from canister state is
/// PUBLIC and PERMANENT. Nothing here may carry a name, an email, free text,
/// an evidence URL, or financial data — only principals and categorical tags.
module {

  /// Why an access-controlled call was refused.
  ///
  /// Returned rather than trapped so that callers get a typed, testable
  /// refusal instead of a canister trap.
  public type AccessError = {
    /// The anonymous principal (`2vxsx-fae`) is never an authorised caller.
    #anonymousCaller;
    /// Caller is authenticated but is not an admin (or not a controller,
    /// for bootstrap).
    #notAuthorized;
    /// Target principal is already in the admin set.
    #alreadyAdmin;
    /// Target principal is not in the admin set.
    #unknownAdmin;
    /// Removing this principal would drop the admin set below its floor.
    #adminFloor;
    /// Bootstrap is finished: the admin set has reached its floor and now
    /// governs itself. This is permanent.
    #bootstrapClosed;
  };
};
