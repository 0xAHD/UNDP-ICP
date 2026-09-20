import Access "../shared/Types";

/// `registry` canister types.
///
/// STORAGE RULE (see CLAUDE.md): this canister's state is PUBLIC and
/// PERMANENT. Only opaque IDs, roles, cohorts, statuses and digests may ever
/// appear here — never a name, an email, free text, an evidence URL, or a
/// financial figure.
///
/// GATED: the credential record itself (digest-keyed records, append-only
/// issuer keys, revocation status) is NOT modelled yet. Its shape is fixed by
/// `claude/gba-credentials-v1-phase2-decisions.md`, which is not in this repo.
/// Do not invent it — see CLAUDE.md, "Deferred work".
module {

  /// Re-exported so registry callers have one error type to match on.
  public type AccessError = Access.AccessError;
};
