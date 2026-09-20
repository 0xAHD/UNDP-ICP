import Map "mo:core/Map";
import Iter "mo:core/Iter";
import Nat "mo:core/Nat";
import Blob "mo:core/Blob";
import Set "mo:core/Set";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Types "../types";
import Admin "Admin";

/// Issuer key management — APPEND-ONLY.
///
/// A key is never removed from the set. Removing one would invalidate every
/// credential it ever signed, which would hand a compromised admin a
/// mass-revocation primitive. Rotation is: add a new key, retire the old one;
/// signatures made by the retired key stay verifiable forever.
module {

  /// Ed25519 public keys are exactly 32 bytes.
  public let publicKeyBytes : Nat = 32;

  public func get(issuer : Types.IssuerState, id : Types.KeyId) : ?Types.IssuerKey {
    issuer.keys.get(id);
  };

  public func list(issuer : Types.IssuerState) : [Types.IssuerKey] {
    issuer.keys.values().toArray();
  };

  public func count(issuer : Types.IssuerState) : Nat {
    issuer.keys.size();
  };

  /// Add an issuer key. Admin only.
  ///
  /// Rejects a duplicate public key: two ids for one key would make
  /// `issuerKeyId` ambiguous for auditing, and retiring one id would leave the
  /// same key usable under the other.
  public func add(
    admins : Set.Set<Principal>,
    issuer : Types.IssuerState,
    caller : Principal,
    publicKey : Blob,
    today : Types.Date,
  ) : Result.Result<Types.KeyId, Types.KeyError> {
    switch (Admin.requireAdmin(admins, caller)) {
      case (#err(#anonymousCaller)) { return #err(#anonymousCaller) };
      case (#err _) { return #err(#notAuthorized) };
      case (#ok) {};
    };
    if (publicKey.size() != publicKeyBytes) { return #err(#badKeyLength) };
    for (existing in issuer.keys.values()) {
      if (existing.publicKey == publicKey) { return #err(#duplicateKey) };
    };
    let id = issuer.nextId;
    issuer.keys.add(id, { id; publicKey; status = #active; addedAt = today });
    issuer.nextId += 1;
    #ok(id);
  };

  /// Change a key's status. Admin only. The key itself is never removed.
  ///
  /// Marking a key `#compromised` does NOT invalidate credentials it signed —
  /// affected records are revoked explicitly, so the decision is visible per
  /// credential rather than silent and wholesale (phase2-decisions §6).
  public func setStatus(
    admins : Set.Set<Principal>,
    issuer : Types.IssuerState,
    caller : Principal,
    id : Types.KeyId,
    status : Types.KeyStatus,
  ) : Result.Result<(), Types.KeyError> {
    switch (Admin.requireAdmin(admins, caller)) {
      case (#err(#anonymousCaller)) { return #err(#anonymousCaller) };
      case (#err _) { return #err(#notAuthorized) };
      case (#ok) {};
    };
    switch (issuer.keys.get(id)) {
      case null { #err(#unknownKey) };
      case (?key) {
        issuer.keys.add(id, { key with status });
        #ok;
      };
    };
  };
};
