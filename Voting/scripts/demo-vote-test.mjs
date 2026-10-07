/**
 * End-to-end check of the vote rules against the running dev server + Hardhat chain:
 * home-ballot lookup → cross-seat vote refused → app vote → app change → third app
 * vote refused → station vote overrides → everything locked.
 *
 *   node scripts/demo-vote-test.mjs            (after scripts/seed-demo-election.mjs)
 *
 * Uses the "Rules Test Voter" (DEMO000003, Karad North) from the demo seed. The face
 * check and OTP email are stubbed (signed biometric token, known OTP hash); every vote
 * goes through the real /api/auth/send-otp and /api/auth/verify-otp routes and the
 * on-chain relay.
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
const { default: Enrollment } = await import('../lib/models/Enrollment.js');
const { default: Candidate } = await import('../lib/models/Candidate.js');
const { default: EmailOTP } = await import('../lib/models/EmailOTP.js');
const { issueBiometricToken } = await import('../lib/biometric.js');
const { issueStationToken, STATION_COOKIE } = await import('../lib/stationSession.js');
const { getReadContract } = await import('../lib/relay.js');

const BASE = process.env.DEMO_BASE_URL || 'http://localhost:3000';
const VOTER_ID = 'DEMO000003';
const EMAIL = 'demo.rules@blockvote.local';
const OTP = '424242';

await connectDB();
const election = await Election.findOne({ title: 'Demo Election 2026' }).sort({ createdAt: -1 }).lean();
if (!election) throw new Error('Demo election not found — run scripts/seed-demo-election.mjs first');
const electionId = election.electionId;
const enrollment = await Enrollment.findOne({ electionId, voterId: VOTER_ID });
if (!enrollment) throw new Error('Demo enrollment not found — re-run scripts/seed-demo-election.mjs');
await Enrollment.updateOne({ _id: enrollment._id }, { votesCast: 0, stationVoteFinal: false });

const home = await Candidate.find({ electionId, constituencyCode: enrollment.constituencyCode }).sort({ candidateId: 1 }).lean();
const away = await Candidate.findOne({ electionId, constituencyCode: { $ne: enrollment.constituencyCode } }).lean();
if (home.length < 3 || !away) throw new Error('Demo candidates not found — re-run scripts/seed-demo-election.mjs');

const biometricToken = issueBiometricToken(enrollment.nullifierHash);
// A booth in a different city: the ballot must still be the home seat.
const stationCookie = `${STATION_COOKIE}=${issueStationToken({
  electionId, stationName: 'Mumbai relay booth', adminId: String(election.createdBy), state: 'Maharashtra', district: 'Mumbai',
}).token}`;

async function post(route, body, headers = {}) {
  const res = await fetch(`${BASE}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function get(route, headers = {}) {
  const res = await fetch(`${BASE}${route}`, { headers });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function requestOtp() {
  const r = await post('/api/auth/send-otp', { voterId: VOTER_ID, electionId });
  if (r.status !== 200) throw new Error(`send-otp ${r.status}: ${r.body.error}`);
  await EmailOTP.updateOne(
    { email: EMAIL, purpose: 'vote', electionId },
    { otp: await bcrypt.hash(OTP, 8) },
  );
}

const vote = (candidateId, { station = false } = {}) =>
  post(
    '/api/auth/verify-otp',
    { voterId: VOTER_ID, otp: OTP, electionId, candidateId, biometricToken },
    station ? { cookie: stationCookie } : {},
  );

let failures = 0;
function check(label, r, expectStatus, extra = () => true) {
  const ok = r.status === expectStatus && extra(r.body);
  if (!ok) failures++;
  const detail = r.body.message || r.body.error || '';
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${r.status} ${r.body.code || ''} ${detail}`);
}

check(
  '0a. voter slip shows home seat',
  await get(`/api/voters/lookup?voterId=${VOTER_ID}&electionId=${electionId}`),
  200,
  (b) => b.slip?.constituencyCode === enrollment.constituencyCode,
);
check(
  '0b. ballot at a far-away booth is still the home seat',
  await get(`/api/elections/${electionId}/ballot?voterId=${VOTER_ID}`, { cookie: stationCookie }),
  200,
  (b) => b.candidates?.length === home.length && b.candidates.every((c) => c.constituencyCode === enrollment.constituencyCode),
);

await requestOtp();
check('0c. vote for another seat refused', await vote(away.candidateId), 403, (b) => b.code === 'WRONG_SEAT');

check(`1. first app vote (${home[0].name})`, await vote(home[0].candidateId), 200, (b) => b.channel === 'app' && b.votesRemaining === 1);

await requestOtp();
check(`2. app change of mind (${home[1].name})`, await vote(home[1].candidateId), 200, (b) => b.isRevote && b.votesRemaining === 0 && b.isFinal);

await requestOtp();
check('3. third app vote refused', await vote(home[2].candidateId), 403, (b) => b.code === 'VOTE_LIMIT_REACHED');

check(`4. station vote overrides (${home[2].name})`, await vote(home[2].candidateId, { station: true }), 200, (b) => b.channel === 'station' && b.isFinal);

await requestOtp();
check('5. app vote after station refused', await vote(home[0].candidateId), 403, (b) => b.code === 'STATION_VOTE_FINAL');
check('6. second station vote refused', await vote(home[0].candidateId, { station: true }), 403, (b) => b.code === 'STATION_VOTE_FINAL');

const contract = getReadContract();
const [, revisions] = await contract.getVoteStatus(enrollment.nullifierHash, electionId);
const after = await Enrollment.findById(enrollment._id).lean();
const ledgerOk = after.votesCast === 3 && after.stationVoteFinal === true && Number(revisions) === 2
  && after.votedVia === 'station' && after.votedAtBoothName === 'Mumbai relay booth' && after.constituencyCode === enrollment.constituencyCode;
if (!ledgerOk) failures++;
console.log(`${ledgerOk ? 'PASS' : 'FAIL'}  7. ledger: votesCast=${after.votesCast} stationVoteFinal=${after.stationVoteFinal} booth=${after.votedAtBoothName} seat=${after.constituencyCode} on-chain revisions=${revisions}`);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll vote-rule checks passed');
process.exit(failures ? 1 : 0);
