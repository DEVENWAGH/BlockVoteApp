/**
 * End-to-end check of the vote rules against the running dev server + Hardhat chain:
 * app vote → app change → third app vote refused → station vote overrides → everything locked.
 *
 *   node scripts/demo-vote-test.mjs            (after scripts/seed-demo-election.mjs)
 *
 * Uses the "Rules Test Voter" from the demo seed. The face check and OTP email are
 * stubbed (signed biometric token, known OTP hash); every vote goes through the real
 * /api/auth/send-otp and /api/auth/verify-otp routes and the on-chain relay.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['.env.development.local', '.env.local', '.env.development', '.env']) {
  const p = path.join(ROOT, file);
  if (fs.existsSync(p)) process.loadEnvFile(p);
}

const { default: bcrypt } = await import('bcryptjs');
const { default: connectDB } = await import('../lib/db.js');
const { default: Election } = await import('../lib/models/Election.js');
const { default: Voter } = await import('../lib/models/Voter.js');
const { default: EmailOTP } = await import('../lib/models/EmailOTP.js');
const { issueBiometricToken } = await import('../lib/biometric.js');
const { issueStationToken, STATION_COOKIE } = await import('../lib/stationSession.js');
const { getReadContract } = await import('../lib/relay.js');

const BASE = process.env.DEMO_BASE_URL || 'http://localhost:3000';
const EMAIL = 'demo.rules@blockvote.local';
const OTP = '424242';

await connectDB();
const election = await Election.findOne({ title: 'Demo Election 2026' }).sort({ createdAt: -1 }).lean();
if (!election) throw new Error('Demo election not found — run scripts/seed-demo-election.mjs first');
const electionId = election.electionId;
const voter = await Voter.findOne({ electionId, email: EMAIL });
await Voter.updateOne({ _id: voter._id }, { votesCast: 0, stationVoteFinal: false });

const biometricToken = issueBiometricToken(voter.nullifierHash);
const stationCookie = `${STATION_COOKIE}=${issueStationToken({
  electionId, stationName: 'Rules test booth', adminId: String(election.createdBy),
}).token}`;

async function post(route, body, headers = {}) {
  const res = await fetch(`${BASE}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function requestOtp() {
  const r = await post('/api/auth/send-otp', { email: EMAIL, electionId });
  if (r.status !== 200) throw new Error(`send-otp ${r.status}: ${r.body.error}`);
  await EmailOTP.updateOne(
    { email: EMAIL, purpose: 'vote', electionId },
    { otp: await bcrypt.hash(OTP, 8) },
  );
}

const vote = (candidateId, { station = false } = {}) =>
  post(
    '/api/auth/verify-otp',
    { email: EMAIL, otp: OTP, electionId, candidateId, biometricToken },
    station ? { cookie: stationCookie } : {},
  );

let failures = 0;
function check(label, r, expectStatus, extra = () => true) {
  const ok = r.status === expectStatus && extra(r.body);
  if (!ok) failures++;
  const detail = r.body.message || r.body.error || '';
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${r.status} ${r.body.code || ''} ${detail}`);
}

await requestOtp();
check('1. first app vote (Asha)', await vote(0), 200, (b) => b.channel === 'app' && b.votesRemaining === 1);

await requestOtp();
check('2. app change of mind (Rohan)', await vote(1), 200, (b) => b.isRevote && b.votesRemaining === 0 && b.isFinal);

await requestOtp();
check('3. third app vote refused', await vote(2), 403, (b) => b.code === 'VOTE_LIMIT_REACHED');

check('4. station vote overrides (Neha)', await vote(2, { station: true }), 200, (b) => b.channel === 'station' && b.isFinal);

await requestOtp();
check('5. app vote after station refused', await vote(0), 403, (b) => b.code === 'STATION_VOTE_FINAL');
check('6. second station vote refused', await vote(0, { station: true }), 403, (b) => b.code === 'STATION_VOTE_FINAL');

const contract = getReadContract();
const [, revisions] = await contract.getVoteStatus(voter.nullifierHash, electionId);
const after = await Voter.findById(voter._id).lean();
const ledgerOk = after.votesCast === 3 && after.stationVoteFinal === true && Number(revisions) === 2;
if (!ledgerOk) failures++;
console.log(`${ledgerOk ? 'PASS' : 'FAIL'}  7. ledger: votesCast=${after.votesCast} stationVoteFinal=${after.stationVoteFinal} on-chain revisions=${revisions}`);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll vote-rule checks passed');
process.exit(failures ? 1 : 0);
