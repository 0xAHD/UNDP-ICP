// SPIKE client: fetch the certificate from spike_certified and verify it
// against the local replica's root key, then extract the certified_data leaf
// and compare it with the value the canister claims.
import { HttpAgent, Actor, Certificate, lookup_path } from '@icp-sdk/core/agent';
import { Principal } from '@icp-sdk/core/principal';
import { IDL } from '@icp-sdk/core/candid';

const HOST = 'http://127.0.0.1:8100';
const canisterId = process.argv[2];
if (!canisterId) { console.error('usage: node verify-certificate.mjs <canisterId>'); process.exit(2); }

const idl = ({ IDL }) => IDL.Service({
  read: IDL.Func([], [IDL.Record({
    certified: IDL.Vec(IDL.Nat8),
    certificate: IDL.Opt(IDL.Vec(IDL.Nat8)),
    certificateSize: IDL.Nat,
  })], ['query']),
});

const hex = (u8) => Buffer.from(u8).toString('hex');

const agent = await HttpAgent.create({ host: HOST, shouldFetchRootKey: true });
const actor = Actor.createActor(idl, { agent, canisterId });

const r = await actor.read();
const claimed = new Uint8Array(r.certified);
const certBytes = r.certificate[0] ? new Uint8Array(r.certificate[0]) : null;

console.log('canister        :', canisterId);
console.log('claimed value   :', hex(claimed));
console.log('certificate     :', certBytes ? certBytes.length + ' bytes' : 'ABSENT');
if (!certBytes) process.exit(1);

// Verify the certificate's BLS signature against the replica root key, then
// read /canister/<id>/certified_data out of the verified state tree.
console.log('rootKey         :', agent.rootKey ? agent.rootKey.byteLength + ' bytes' : 'MISSING');
let cert;
try {
  cert = await Certificate.create({
    certificate: certBytes,
    rootKey: new Uint8Array(agent.rootKey),
    principal: { canisterId: Principal.fromText(canisterId) },
  });
} catch (e) {
  console.log('VERIFY FAILED   :', e && e.message ? e.message : String(e));
  console.log('error name      :', e && e.name);
  process.exit(3);
}

const path = [
  new TextEncoder().encode('canister'),
  Principal.fromText(canisterId).toUint8Array(),
  new TextEncoder().encode('certified_data'),
];
const certified = cert.lookup_path(path);
console.log('lookup status   :', certified?.status ?? '(raw)');
const raw = certified?.value ?? certified;
const certifiedBytes = raw && raw.byteLength !== undefined ? new Uint8Array(raw) : null;

console.log('BLS signature   : VERIFIED (Certificate.create did not throw)');
console.log('certified_data  :', certifiedBytes ? hex(certifiedBytes) : 'NOT PRESENT IN TREE');

const timePath = [new TextEncoder().encode('time')];
const t = cert.lookup_path(timePath);
console.log('cert has /time  :', t ? 'yes' : 'no');

const match = certifiedBytes && hex(certifiedBytes) === hex(claimed);
console.log('');
console.log('MATCHES CLAIM   :', !!match);
process.exit(match ? 0 : 1);
