import Access "../shared/Types";

/// `ops` canister types.
///
/// STORAGE RULE (see CLAUDE.md): this canister's state is PUBLIC and
/// PERMANENT. Participant names, emails, evidence URLs, funding notes and any
/// financial figure live in an OFF-CHAIN store — never here. On-chain, a
/// participant is an opaque ID plus categorical fields.
///
/// GATED — do not model these without a decision from Ahmed:
///   * the participant / cohort / milestone record shape, which waits on the
///     funding-note storage basis (a UNDP data-protection call),
///   * which off-chain store holds participant names,
///   * the per-role completion-rule values.
/// See CLAUDE.md, "Deferred work". This canister therefore carries governance
/// state only for now.
module {

  /// Re-exported so ops callers have one error type to match on.
  public type AccessError = Access.AccessError;
};
