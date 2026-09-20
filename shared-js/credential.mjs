// Canonical credential document format v1 — shared by the issuer and the
// verification page so both hash EXACTLY the same bytes.
//
// [PROPOSED] Needs sign-off. Flagged in gba-credentials-v1-phase1-results.md §4
// as the gap that makes two verifiers disagree about the same document.
//
// THE DOCUMENT CONTAINS PERSONAL DATA BY DESIGN (the holder's name). It lives
// off chain and is handed to the holder. Only its DIGEST goes on chain, and
// that digest is safe to publish only because `credentialId` is 128 bits of
// randomness — see claude/personal-data-on-chain.md §4. Hashing a document
// without that random field would be brute-forceable against a known cohort.

/// Field order is part of the format. Serialising in any other order produces
/// a different digest and the credential will not verify.
export const FIELD_ORDER = [
  "v",
  "credentialId",
  "holder",
  "cohort",
  "role",
  "outcome",
  "issuedOn",
];

/// Canonical bytes: compact JSON, keys in FIELD_ORDER, no whitespace, UTF-8.
/// Deliberately not "JSON.stringify(obj)" — object key order is an
/// implementation detail and would silently change the digest.
export function canonicalBytes(doc) {
  for (const k of FIELD_ORDER) {
    if (doc[k] === undefined || doc[k] === null || doc[k] === "") {
      throw new Error(`credential document is missing required field: ${k}`);
    }
  }
  const extra = Object.keys(doc).filter((k) => !FIELD_ORDER.includes(k));
  if (extra.length) {
    // An unknown field would be dropped by the serialiser, so the digest would
    // not cover it — a silent integrity hole. Refuse instead.
    throw new Error(`unknown field(s) in credential document: ${extra.join(", ")}`);
  }
  const ordered = FIELD_ORDER.map(
    (k) => `${JSON.stringify(k)}:${JSON.stringify(doc[k])}`,
  ).join(",");
  return new TextEncoder().encode(`{${ordered}}`);
}

/// SHA-256 over the canonical bytes. Works in node and the browser.
export async function digestOf(doc) {
  const bytes = canonicalBytes(doc);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(hash);
}

export const toHex = (u8) =>
  [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");

export const fromHex = (hex) =>
  new Uint8Array((hex.trim().match(/[0-9a-fA-F]{2}/g) ?? []).map((h) => parseInt(h, 16)));
