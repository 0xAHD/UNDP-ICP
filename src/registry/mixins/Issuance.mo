import Map "mo:core/Map";
import Blob "mo:core/Blob";
import Set "mo:core/Set";
import Principal "mo:core/Principal";
import Result "mo:core/Result";
import Types "../types";
import Credentials "../lib/Credentials";
import Issuer "../lib/Issuer";

/// Admin-only issuance and issuer-key management.
///
/// Every method rejects the anonymous principal and requires an admin, and
/// returns a typed `#err` rather than trapping. All synchronous — the canister
/// never signs, so there is no `await` and no reentrancy surface.
mixin (
  admins : Set.Set<Principal>,
  issuer : Types.IssuerState,
  records : Map.Map<Blob, Types.Record>,
) {

  /// Add an Ed25519 issuer public key (32 bytes). Issuer keys are append-only.
  public shared ({ caller }) func addIssuerKey(
    publicKey : Blob
  ) : async Result.Result<Types.KeyId, Types.KeyError> {
    Issuer.add(admins, issuer, caller, publicKey, Credentials.today());
  };

  /// Retire or flag an issuer key. The key is never removed, so credentials it
  /// already signed stay verifiable.
  public shared ({ caller }) func setIssuerKeyStatus(
    id : Types.KeyId,
    status : Types.KeyStatus,
  ) : async Result.Result<(), Types.KeyError> {
    Issuer.setStatus(admins, issuer, caller, id, status);
  };

  /// Record a credential: its digest, which key signed it, and the signature.
  /// Idempotent per digest — a duplicate is refused, never overwritten.
  public shared ({ caller }) func issue(
    digest : Blob,
    issuerKeyId : Types.KeyId,
    signature : Blob,
  ) : async Result.Result<(), Types.IssueError> {
    Credentials.issue(admins, issuer, records, caller, digest, issuerKeyId, signature);
  };

  /// Revoke a credential. The record stays; only its status changes.
  public shared ({ caller }) func revoke(
    digest : Blob
  ) : async Result.Result<(), Types.RevokeError> {
    Credentials.revoke(admins, records, caller, digest);
  };

  /// How many credential records exist. Deliberately a count, not a listing —
  /// there is no method to enumerate digests, so cohort membership cannot be
  /// harvested from the chain.
  public query func credentialCount() : async Nat {
    Credentials.count(records);
  };
};
