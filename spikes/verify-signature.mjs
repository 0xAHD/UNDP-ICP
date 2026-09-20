// SPIKE client: verify a threshold-Ed25519 signature produced by spike_signer.
// Usage: node verify-signature.mjs <pubkeyHex> <sigHex> <message>
import crypto from 'node:crypto';
const [pubHex, sigHex, msg] = process.argv.slice(2);
if (!pubHex || !sigHex || msg === undefined) {
  console.error('usage: node verify-signature.mjs <pubkeyHex> <sigHex> <message>');
  process.exit(2);
}
// Wrap the raw 32-byte Ed25519 key as SPKI DER so node can import it.
const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(pubHex, 'hex')]);
const key = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
const ok = crypto.verify(null, Buffer.from(msg, 'utf8'), key, Buffer.from(sigHex, 'hex'));
const tampered = crypto.verify(null, Buffer.from(msg + '!', 'utf8'), key, Buffer.from(sigHex, 'hex'));
console.log('pubkey bytes :', Buffer.from(pubHex, 'hex').length);
console.log('sig bytes    :', Buffer.from(sigHex, 'hex').length);
console.log('VERIFIES     :', ok);
console.log('tampered msg :', tampered, '(must be false)');
process.exit(ok && !tampered ? 0 : 1);
