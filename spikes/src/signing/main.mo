import Error "mo:core/Error";
import Blob "mo:core/Blob";
import Text "mo:core/Text";

/// SPIKE — throwaway. Answers one question: does threshold Ed25519 signing
/// work on a LOCAL replica via the management canister?
///
/// Bakes in no schema and is not part of the product. On a cloud engine this
/// path does NOT work at all (engines provide no threshold signing); see
/// CLAUDE.md. Here we only establish what is testable locally.
persistent actor {

  type SchnorrAlgorithm = { #ed25519; #bip340secp256k1 };
  type SchnorrKeyId = { algorithm : SchnorrAlgorithm; name : Text };

  type SchnorrPublicKeyArgs = {
    canister_id : ?Principal;
    derivation_path : [Blob];
    key_id : SchnorrKeyId;
  };
  type SchnorrPublicKeyReply = { public_key : Blob; chain_code : Blob };

  type SignWithSchnorrArgs = {
    message : Blob;
    derivation_path : [Blob];
    key_id : SchnorrKeyId;
    aux : ?{ #bip341 : { merkle_root_hash : Blob } };
  };
  type SignWithSchnorrReply = { signature : Blob };

  transient let ic = actor "aaaaa-aa" : actor {
    schnorr_public_key : SchnorrPublicKeyArgs -> async SchnorrPublicKeyReply;
    sign_with_schnorr : SignWithSchnorrArgs -> async SignWithSchnorrReply;
  };

  type Probe = {
    #ok : { size : Nat; bytes : Blob };
    #err : Text;
  };

  /// Is an Ed25519 threshold key with this name available here?
  public func probePublicKey(keyName : Text) : async Probe {
    try {
      let r = await ic.schnorr_public_key({
        canister_id = null;
        derivation_path = [];
        key_id = { algorithm = #ed25519; name = keyName };
      });
      #ok { size = r.public_key.size(); bytes = r.public_key };
    } catch (e) {
      #err(e.message());
    };
  };

  /// Can we actually produce a signature with it?
  public func probeSign(keyName : Text, message : Text, cycles : Nat) : async Probe {
    try {
      let r = await (with cycles = cycles) ic.sign_with_schnorr({
        message = message.encodeUtf8();
        derivation_path = [];
        key_id = { algorithm = #ed25519; name = keyName };
        aux = null;
      });
      #ok { size = r.signature.size(); bytes = r.signature };
    } catch (e) {
      #err(e.message());
    };
  };
};
