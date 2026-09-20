import Set "mo:core/Set";
import Principal "mo:core/Principal";
import SharedTypes "../shared/Types";
import Map "mo:core/Map";
import Blob "mo:core/Blob";
import Types "types";
import AdminApi "mixins/Admin";
import MetaApi "mixins/Meta";
import IssuanceApi "mixins/Issuance";
import VerifyApi "mixins/Verify";

/// UNDP AltFinLab Cohort Tracker — `registry` canister.
///
/// THIS CANISTER'S PRINCIPAL IS THE CREDENTIAL DID, PERMANENTLY.
/// Never reinstall, delete, or recreate it. `.icp/data/` holds the name-to-ID
/// mapping and must stay committed. See CLAUDE.md.
///
/// Composition root only — no public methods are declared here; endpoints come
/// from the mixins. Stable fields are declared with types only; their initial
/// values come from the migration chain in `migrations/`.
persistent actor {

  /// Principals permitted to administer the registry.
  /// Governance state only — this canister holds no participant data.
  let admins : Set.Set<Principal>;

  /// Stable-shape version, supplied by the migration chain.
  /// Named `schema` because `include` injects mixin names into this same
  /// scope, and the Meta mixin exposes a `schemaVersion` query.
  /// Latch recording that bootstrap has finished. See shared/Types.mo.
  let bootstrap : SharedTypes.BootstrapState;

  /// Issuer public keys, APPEND-ONLY, plus the id counter. The private keys
  /// are held OFF CHAIN — this canister never signs.
  let issuer : Types.IssuerState;

  /// Credential records, keyed by the digest of the credential document.
  /// Holds no participant data: see types.mo.
  let records : Map.Map<Blob, Types.Record>;

  let schema : Nat;

  include AdminApi(admins, bootstrap);
  include MetaApi(schema);
  include IssuanceApi(admins, issuer, records);
  include VerifyApi(issuer, records);
};
