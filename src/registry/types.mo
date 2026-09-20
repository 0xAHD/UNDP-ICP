import Map "mo:core/Map";
import Access "../shared/Types";

/// `registry` canister types.
///
/// STORAGE RULE (see claude/personal-data-on-chain.md): this canister's state
/// is PUBLIC and PERMANENT. Every field below is categorical, numeric, or a
/// digest/signature — never a name, email, free text, evidence URL, or
/// financial figure.
///
/// Deliberately NOT stored on a credential record: participant ID, cohort, and
/// role. Any of those would let anyone enumerate cohort membership from the
/// chain, which `gba-credentials-v1-plan.md` §3 rules out. The digest IS the
/// key; someone holding a credential document can confirm it, and nobody can
/// enumerate participants.
module {

  /// Re-exported so registry callers have one error type to match on.
  public type AccessError = Access.AccessError;

  /// Days since the Unix epoch. A DATE, not a timestamp — a second-resolution
  /// issuance time can single a person out in a small cohort
  /// (phase2-decisions §2). Computed by the canister, never supplied by a
  /// caller, so it cannot be backdated.
  public type Date = Nat;

  /// Identifier for an issuer key. Assigned from an explicit counter, never
  /// derived from the key-set size — issuer keys are append-only today, but a
  /// derived id would collide the moment that changed.
  public type KeyId = Nat;

  /// Issuer keys are APPEND-ONLY. A key is never deleted: removing one would
  /// invalidate every credential it ever signed, handing a compromised admin a
  /// mass-revocation primitive. Status changes instead.
  public type KeyStatus = {
    /// May sign new credentials.
    #active;
    /// Signs nothing new; existing signatures stay valid.
    #retired;
    /// Treat its signatures as suspect. Does NOT auto-invalidate past
    /// credentials — affected records are revoked explicitly, so the decision
    /// is visible per credential (phase2-decisions §6).
    #compromised;
  };

  /// An Ed25519 issuer public key. The PRIVATE key is held off chain
  /// (phase2-decisions §3, option C) — the canister never signs.
  public type IssuerKey = {
    id : KeyId;
    /// 32-byte Ed25519 public key.
    publicKey : Blob;
    status : KeyStatus;
    addedAt : Date;
  };

  public type Status = { #active; #revoked };

  /// A credential record, keyed by the digest of the credential document.
  ///
  /// The document itself is off chain and contains a random credential ID,
  /// which supplies the entropy that makes publishing this digest safe
  /// (personal-data-on-chain.md §4). A digest of a bare identifier would be
  /// brute-forceable and must never be stored.
  public type Record = {
    status : Status;
    statusChangedAt : Date;
    issuerKeyId : KeyId;
    /// 64-byte Ed25519 signature over the digest, produced off chain.
    /// The canister stores it; clients verify it against `publicKey`.
    signature : Blob;
  };

  /// Issuer key set plus its id counter.
  public type IssuerState = {
    keys : Map.Map<KeyId, IssuerKey>;
    var nextId : KeyId;
  };

  public type IssueError = {
    #anonymousCaller;
    #notAuthorized;
    /// A record already exists for this digest. Issuance is idempotent per
    /// digest: a retry must never create a second record.
    #duplicateDigest;
    #unknownIssuerKey;
    /// The key exists but is retired or compromised.
    #issuerKeyNotActive;
    /// Digests are 32 bytes (SHA-256).
    #badDigestLength;
    /// Ed25519 signatures are 64 bytes.
    #badSignatureLength;
  };

  public type RevokeError = {
    #anonymousCaller;
    #notAuthorized;
    #unknownDigest;
    #alreadyRevoked;
  };

  public type KeyError = {
    #anonymousCaller;
    #notAuthorized;
    /// Ed25519 public keys are 32 bytes.
    #badKeyLength;
    #unknownKey;
    /// This exact public key is already in the set.
    #duplicateKey;
  };

  /// What a verifier gets back. `#unknown` is a first-class answer, not an
  /// error — "we have never seen this digest" is a valid verification result.
  public type VerifyReply = {
    #unknown;
    #found : { credential : Record; issuerKey : IssuerKey };
  };
};
