import Map "mo:core/Map";
import Blob "mo:core/Blob";
import Nat "mo:core/Nat";
import Set "mo:core/Set";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Time "mo:core/Time";
import Int "mo:core/Int";
import Types "../types";
import Admin "Admin";
import Issuer "Issuer";

/// Credential records, keyed by the digest of the credential document.
///
/// The canister NEVER signs and NEVER verifies signatures. The issuer private
/// key is held off chain (phase2-decisions §3, option C), so an off-chain
/// issuer signs the digest and submits the signature here. Verification happens
/// client-side against the issuer public key this module returns — which is
/// also where it belongs, since a verifier must not have to trust us.
///
/// Every function here is synchronous. There is no `await` anywhere in this
/// canister, so there is no TOCTOU or reentrancy surface.
module {

  /// SHA-256 digests are exactly 32 bytes.
  public let digestBytes : Nat = 32;
  /// Ed25519 signatures are exactly 64 bytes.
  public let signatureBytes : Nat = 64;

  let nanosPerDay : Nat = 86_400_000_000_000;

  /// Today, as days since the Unix epoch. Canister-computed so no caller can
  /// backdate a record.
  public func today() : Types.Date {
    Int.abs(Time.now()) / nanosPerDay;
  };

  public func get(records : Map.Map<Blob, Types.Record>, digest : Blob) : ?Types.Record {
    records.get(digest);
  };

  public func count(records : Map.Map<Blob, Types.Record>) : Nat {
    records.size();
  };

  /// Record a credential. Admin only, and idempotent per digest.
  ///
  /// A digest that already has a record is refused rather than overwritten: a
  /// retry must never create or replace a record, and silently overwriting
  /// would let an admin swap the signature on an issued credential.
  public func issue(
    admins : Set.Set<Principal>,
    issuer : Types.IssuerState,
    records : Map.Map<Blob, Types.Record>,
    caller : Principal,
    digest : Blob,
    issuerKeyId : Types.KeyId,
    signature : Blob,
  ) : Result.Result<(), Types.IssueError> {
    switch (Admin.requireAdmin(admins, caller)) {
      case (#err(#anonymousCaller)) { return #err(#anonymousCaller) };
      case (#err _) { return #err(#notAuthorized) };
      case (#ok) {};
    };
    if (digest.size() != digestBytes) { return #err(#badDigestLength) };
    if (signature.size() != signatureBytes) { return #err(#badSignatureLength) };
    switch (Issuer.get(issuer, issuerKeyId)) {
      case null { return #err(#unknownIssuerKey) };
      case (?key) {
        // Only an active key may sign NEW credentials. Retired and compromised
        // keys keep their existing signatures valid, but issue nothing more.
        switch (key.status) {
          case (#active) {};
          case (#retired or #compromised) { return #err(#issuerKeyNotActive) };
        };
      };
    };
    if (records.containsKey(digest)) { return #err(#duplicateDigest) };
    records.add(
      digest,
      {
        status = #active;
        statusChangedAt = today();
        issuerKeyId;
        signature;
      },
    );
    #ok;
  };

  /// Revoke a credential. Admin only. The record is never deleted — a verifier
  /// must SEE revocation, not infer it from a digest having disappeared.
  public func revoke(
    admins : Set.Set<Principal>,
    records : Map.Map<Blob, Types.Record>,
    caller : Principal,
    digest : Blob,
  ) : Result.Result<(), Types.RevokeError> {
    switch (Admin.requireAdmin(admins, caller)) {
      case (#err(#anonymousCaller)) { return #err(#anonymousCaller) };
      case (#err _) { return #err(#notAuthorized) };
      case (#ok) {};
    };
    switch (records.get(digest)) {
      case null { #err(#unknownDigest) };
      case (?rec) {
        switch (rec.status) {
          case (#revoked) { #err(#alreadyRevoked) };
          case (#active) {
            records.add(
              digest,
              { rec with status = #revoked; statusChangedAt = today() },
            );
            #ok;
          };
        };
      };
    };
  };

  /// The public verification answer.
  ///
  /// `#unknown` is a first-class result: "we have never seen this digest" is a
  /// valid verification outcome, not an error. Returns the issuer key alongside
  /// the record so a verifier can check the signature without a second call.
  public func verify(
    issuer : Types.IssuerState,
    records : Map.Map<Blob, Types.Record>,
    digest : Blob,
  ) : Types.VerifyReply {
    switch (records.get(digest)) {
      case null { #unknown };
      case (?credential) {
        switch (Issuer.get(issuer, credential.issuerKeyId)) {
          // An unknown issuer key here would mean the key set lost an entry,
          // which append-only forbids. Treat as unknown rather than trap.
          case null { #unknown };
          case (?issuerKey) { #found { credential; issuerKey } };
        };
      };
    };
  };
};
