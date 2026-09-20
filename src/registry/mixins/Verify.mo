import Map "mo:core/Map";
import Blob "mo:core/Blob";
import Types "../types";
import Credentials "../lib/Credentials";
import Issuer "../lib/Issuer";

/// The public verification surface. No authentication — anyone may verify,
/// including the anonymous principal. That is the point of the rail.
///
/// `verify` is an UPDATE call for v1, not a query. A query is answered by a
/// single replica that could lie; an update goes through consensus, so the
/// answer is trustworthy without any certification plumbing
/// (phase2-decisions §5). The upgrade path to a certified query is recorded
/// there — the record shape does not change, so it is a drop-in replacement.
mixin (issuer : Types.IssuerState, records : Map.Map<Blob, Types.Record>) {

  /// Verify a credential digest. Returns the record and the issuer key that
  /// signed it, so the caller can check the signature client-side.
  ///
  /// `#unknown` means no record for this digest — a valid answer, not an error.
  public func verify(digest : Blob) : async Types.VerifyReply {
    Credentials.verify(issuer, records, digest);
  };

  /// The issuer key set, append-only. A verifier needs this to know which keys
  /// were ever legitimate, and to see that a key is retired or compromised.
  public query func issuerKeys() : async [Types.IssuerKey] {
    Issuer.list(issuer);
  };

  public query func issuerKeyCount() : async Nat {
    Issuer.count(issuer);
  };
};
