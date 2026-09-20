#!/usr/bin/env node
// End-to-end credential flow against a local replica.
// Proves the MVP rail: an OFF-CHAIN issuer signs, the canister records, and a
// verifier checks the signature client-side against the issuer key the
// canister returns. The canister itself never signs and never verifies.
//
// Covers the gate's adversarial cases: duplicate issuance, revoked, tampered,
// unknown digest, non-admin, anonymous.
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ENV = 'local', CAN = 'registry';
let pass = 0, fail = 0;

const icp = (method, args, identity = 'ct-admin-a', extra = []) => {
  try {
    return execFileSync('icp', ['canister', 'call', CAN, method, args,
      '-e', ENV, '--identity', identity, ...extra],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, DO_NOT_TRACK: '1' } }).trim();
  } catch (e) { return ((e.stdout || '') + (e.stderr || '')).trim(); }
};

const check = (label, got, want) => {
  const ok = String(got).includes(want);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(44)} ${ok ? '' : `got:${got} want:${want}`}`);
  ok ? pass++ : fail++;
  return ok;
};

// Candid blob literal <-> bytes
const toBlob = (buf) => `blob "${[...buf].map(b => '\\' + b.toString(16).padStart(2, '0')).join('')}"`;
const fromBlob = (lit) => {
  const body = lit.match(/blob "([^"]*)"/)?.[1] ?? '';
  const out = [];
  for (let i = 0; i < body.length;) {
    if (body[i] === '\\') { out.push(parseInt(body.slice(i + 1, i + 3), 16)); i += 3; }
    else { out.push(body.charCodeAt(i)); i += 1; }
  }
  return Buffer.from(out);
};
const spki = (raw) => Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), raw]);

// --- off-chain issuer: a normal Ed25519 keypair, private key never on chain
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const rawPub = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);

// --- the credential document. Its random ID supplies the entropy that makes
// publishing its digest safe (personal-data-on-chain.md §4).
const credentialId = crypto.randomBytes(16).toString('hex');
const document = JSON.stringify({ credentialId, cohort: 'demo-2026', outcome: 'completed' });
const digest = crypto.createHash('sha256').update(document).digest();
const signature = crypto.sign(null, digest, privateKey);
const otherDigest = crypto.createHash('sha256').update('never issued').digest();

console.log(`CANISTER : ${CAN}`);
console.log(`issuer pk: ${rawPub.toString('hex')}`);
console.log(`digest   : ${digest.toString('hex')}`);
console.log(`signature: ${signature.toString('hex').slice(0, 32)}…\n`);

console.log('-- issuer keys are admin-only and length-checked --');
check('non-admin addIssuerKey', icp('addIssuerKey', `(${toBlob(rawPub)})`, 'ct-outsider'), 'notAuthorized');
check('anonymous addIssuerKey', icp('addIssuerKey', `(${toBlob(rawPub)})`, 'anonymous'), 'anonymousCaller');
check('short key rejected', icp('addIssuerKey', `(${toBlob(Buffer.alloc(31))})`), 'badKeyLength');
const added = icp('addIssuerKey', `(${toBlob(rawPub)})`);
check('admin adds issuer key', added, 'ok');
const keyId = added.match(/ok = ([0-9_]+)/)?.[1]?.replace(/_/g, '') ?? '0';
check('duplicate public key refused', icp('addIssuerKey', `(${toBlob(rawPub)})`), 'duplicateKey');

console.log('\n-- issuance --');
check('non-admin issue', icp('issue', `(${toBlob(digest)}, ${keyId}, ${toBlob(signature)})`, 'ct-outsider'), 'notAuthorized');
check('anonymous issue', icp('issue', `(${toBlob(digest)}, ${keyId}, ${toBlob(signature)})`, 'anonymous'), 'anonymousCaller');
check('short digest rejected', icp('issue', `(${toBlob(Buffer.alloc(31))}, ${keyId}, ${toBlob(signature)})`), 'badDigestLength');
check('short signature rejected', icp('issue', `(${toBlob(digest)}, ${keyId}, ${toBlob(Buffer.alloc(63))})`), 'badSignatureLength');
check('unknown issuer key', icp('issue', `(${toBlob(digest)}, 999, ${toBlob(signature)})`), 'unknownIssuerKey');
check('admin issues credential', icp('issue', `(${toBlob(digest)}, ${keyId}, ${toBlob(signature)})`), 'ok');
check('DUPLICATE issuance refused', icp('issue', `(${toBlob(digest)}, ${keyId}, ${toBlob(signature)})`), 'duplicateDigest');

console.log('\n-- verification (public, anonymous allowed) --');
const reply = icp('verify', `(${toBlob(digest)})`, 'anonymous');
check('verify finds the credential', reply, 'found');
check('status is active', reply, 'active');
const blobs = [...reply.matchAll(/blob "[^"]*"/g)].map(m => fromBlob(m[0]));
const gotSig = blobs.find(b => b.length === 64);
const gotPub = blobs.find(b => b.length === 32);
check('returned pubkey matches issuer', gotPub?.toString('hex'), rawPub.toString('hex'));
check('returned signature matches', gotSig?.toString('hex'), signature.toString('hex'));

// THE cryptographic check a real verifier performs, client-side.
const sigValid = gotPub && gotSig &&
  crypto.verify(null, digest, crypto.createPublicKey({ key: spki(gotPub), format: 'der', type: 'spki' }), gotSig);
check('SIGNATURE VERIFIES client-side', String(sigValid), 'true');
const tamperValid = gotPub && gotSig &&
  crypto.verify(null, otherDigest, crypto.createPublicKey({ key: spki(gotPub), format: 'der', type: 'spki' }), gotSig);
check('TAMPERED digest fails signature', String(tamperValid), 'false');

console.log('\n-- unknown digest --');
check('UNKNOWN digest returns #unknown', icp('verify', `(${toBlob(otherDigest)})`, 'anonymous'), 'unknown');

console.log('\n-- revocation --');
check('non-admin revoke', icp('revoke', `(${toBlob(digest)})`, 'ct-outsider'), 'notAuthorized');
check('unknown digest revoke', icp('revoke', `(${toBlob(otherDigest)})`), 'unknownDigest');
check('admin revokes', icp('revoke', `(${toBlob(digest)})`), 'ok');
const after = icp('verify', `(${toBlob(digest)})`, 'anonymous');
check('REVOKED status is visible', after, 'revoked');
check('revoked record still returned', after, 'found');
check('double revoke refused', icp('revoke', `(${toBlob(digest)})`), 'alreadyRevoked');

console.log('\n-- retired keys sign nothing new --');
check('retire the issuer key', icp('setIssuerKeyStatus', `(${keyId}, variant { retired })`), 'ok');
const d2 = crypto.createHash('sha256').update('second doc ' + credentialId).digest();
check('retired key cannot issue', icp('issue', `(${toBlob(d2)}, ${keyId}, ${toBlob(crypto.sign(null, d2, privateKey))})`), 'issuerKeyNotActive');
check('retired key still verifies old', icp('verify', `(${toBlob(digest)})`, 'anonymous'), 'found');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
