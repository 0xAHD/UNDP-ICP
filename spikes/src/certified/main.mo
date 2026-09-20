import CertifiedData "mo:core/CertifiedData";
import Blob "mo:core/Blob";

/// SPIKE — throwaway. Answers two questions about certified queries:
///   1. Does set -> certificate -> client-side verification work on this
///      toolchain, against a local replica?
///   2. Does certification SURVIVE A CANISTER UPGRADE? The certified-variables
///      skill says certified data is cleared on upgrade and must be re-set in
///      a postupgrade hook — but enhanced orthogonal persistence forbids
///      `system func postupgrade`. That tension is the real question.
///
/// Certifies a caller-supplied 32-byte blob directly, so it needs no Merkle
/// library and no sha2 dependency. Bakes in no schema.
persistent actor {

  /// Last value handed to `CertifiedData.set`.
  var current : Blob = "";

  /// Update call. `CertifiedData.set` accepts at most 32 bytes and traps in
  /// a query, so certification can only happen here.
  public func certify(digest : Blob) : async { size : Nat } {
    CertifiedData.set(digest);
    current := digest;
    { size = digest.size() };
  };

  /// Query call. `getCertificate` returns null outside a query.
  public query func read() : async {
    certified : Blob;
    certificate : ?Blob;
    certificateSize : Nat;
  } {
    let cert = CertifiedData.getCertificate();
    {
      certified = current;
      certificate = cert;
      certificateSize = switch cert { case (?c) { c.size() }; case null { 0 } };
    };
  };

  /// NEGATIVE CONTROL: change the served value WITHOUT re-certifying.
  /// This is exactly what a malicious replica would do — serve data the
  /// certificate does not cover. A correct client must reject it.
  public func tamper(digest : Blob) : async { size : Nat } {
    current := digest;
    { size = digest.size() };
  };

  /// Does a certificate exist right now, without shipping the bytes?
  public query func hasCertificate() : async Bool {
    switch (CertifiedData.getCertificate()) { case (?_) { true }; case null { false } };
  };
};
