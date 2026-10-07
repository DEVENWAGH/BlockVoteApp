/**
 * Seeds a live demo election on the local Hardhat chain + MongoDB for manual testing.
 *
 *   node scripts/seed-demo-election.mjs
 *
 * Creates (or reuses) a demo admin, three parties with symbols, one assembly seat
 * list, a master roll of demo voters with home places, a fresh ASSEMBLY election
 * on-chain with one candidate per party in each seat, enrolls the demo voters and
 * opens voting. Re-running replaces the previous demo election.
 * Requires the dev backend (Hardhat on :8545) to be running.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Same precedence as Next.js: earlier files win because loadEnvFile never overrides.
for (const file of ['.env.development.local', '.env.local', '.env.development', '.env']) {
  const p = path.join(ROOT, file);
  if (fs.existsSync(p)) process.loadEnvFile(p);
}

const { default: bcrypt } = await import('bcryptjs');
const { default: connectDB } = await import('../lib/db.js');
const { default: Admin } = await import('../lib/models/Admin.js');
const { default: Election } = await import('../lib/models/Election.js');
const { default: Candidate } = await import('../lib/models/Candidate.js');
const { default: Voter } = await import('../lib/models/Voter.js');
const { default: Enrollment } = await import('../lib/models/Enrollment.js');
const { default: Party } = await import('../lib/models/Party.js');
const { default: Constituency } = await import('../lib/models/Constituency.js');
const { default: EmailOTP } = await import('../lib/models/EmailOTP.js');
const relay = await import('../lib/relay.js');
const { computeNullifierHash } = await import('../lib/voterIdentity.js');

export const DEMO_ADMIN = {
  name: 'BlockVote Demo',
  email: 'demo-admin@blockvote.local',
  password: 'DemoAdmin@2026',
};
export const DEMO_TITLE = 'Demo Election 2026';
const ASSET_ORIGIN = process.env.DEMO_ASSET_ORIGIN || 'http://192.168.31.171:3000';

const PARTIES = [
  { code: 'PP', name: 'Progress Party', symbol: `${ASSET_ORIGIN}/logo.png` },
  { code: 'UF', name: 'Unity Front', symbol: `${ASSET_ORIGIN}/logo.png` },
  { code: 'GA', name: 'Green Alliance', symbol: `${ASSET_ORIGIN}/logo.png` },
];

const SEATS = [
  { code: 'MH-AC-258', name: 'Karad North', level: 'assembly', state: 'Maharashtra', district: 'Satara', parentCode: 'MH-PC-45' },
  { code: 'MH-AC-210', name: 'Kothrud', level: 'assembly', state: 'Maharashtra', district: 'Pune', parentCode: 'MH-PC-34' },
  { code: 'MH-PC-45', name: 'Satara', level: 'loksabha', state: 'Maharashtra' },
  { code: 'MH-PC-34', name: 'Pune', level: 'loksabha', state: 'Maharashtra' },
];

/** Same party, different candidate in each seat. */
const CANDIDATES = [
  { seat: 'MH-AC-258', partyCode: 'PP', name: 'Asha Patil', manifesto: 'Better roads and water for Karad North.' },
  { seat: 'MH-AC-258', partyCode: 'UF', name: 'Rohan Mehta', manifesto: 'Digital services for every village.' },
  { seat: 'MH-AC-258', partyCode: 'GA', name: 'Neha Kulkarni', manifesto: 'Clean water and solar schools.' },
  { seat: 'MH-AC-210', partyCode: 'PP', name: 'Vikram Joshi', manifesto: 'Metro and parks for Kothrud.' },
  { seat: 'MH-AC-210', partyCode: 'UF', name: 'Priya Deshmukh', manifesto: 'Safer streets and clinics.' },
  { seat: 'MH-AC-210', partyCode: 'GA', name: 'Sameer Shaikh', manifesto: 'Green Kothrud by 2030.' },
];

/** Master roll — home place decides the ballot; the booth never does. */
const VOTERS = [
  { voterId: 'DEMO000001', name: 'App Demo Voter', email: 'demo.app@blockvote.local', state: 'Maharashtra', district: 'Satara', village: 'Malkapur', ward: '4', assemblyConstituency: 'MH-AC-258', parliamentaryConstituency: 'MH-PC-45' },
  { voterId: 'DEMO000002', name: 'Station Demo Voter', email: 'demo.station@blockvote.local', state: 'Maharashtra', district: 'Pune', city: 'Pune', ward: '17', assemblyConstituency: 'MH-AC-210', parliamentaryConstituency: 'MH-PC-34' },
  { voterId: 'DEMO000003', name: 'Rules Test Voter', email: 'demo.rules@blockvote.local', state: 'Maharashtra', district: 'Satara', village: 'Malkapur', ward: '2', assemblyConstituency: 'MH-AC-258', parliamentaryConstituency: 'MH-PC-45' },
];

await connectDB();

let admin = await Admin.findOne({ email: DEMO_ADMIN.email });
if (!admin) {
  admin = await Admin.create({
    name: DEMO_ADMIN.name,
    email: DEMO_ADMIN.email,
    passwordHash: await bcrypt.hash(DEMO_ADMIN.password, 10),
    isEmailVerified: true,
  });
}

const old = await Election.find({ createdBy: admin._id }).select('electionId').lean();
const oldIds = old.map((e) => e.electionId);
if (oldIds.length) {
  await Promise.all([
    Election.deleteMany({ electionId: { $in: oldIds } }),
    Candidate.deleteMany({ electionId: { $in: oldIds } }),
    Enrollment.deleteMany({ electionId: { $in: oldIds } }),
    EmailOTP.deleteMany({ electionId: { $in: oldIds } }),
  ]);
}

// Shared registries (idempotent)
for (const p of PARTIES) {
  await Party.updateOne({ code: p.code }, { $set: { ...p, createdBy: admin._id } }, { upsert: true });
}
for (const s of SEATS) {
  await Constituency.updateOne({ code: s.code }, { $set: { ...s, createdBy: admin._id } }, { upsert: true });
}
for (const v of VOTERS) {
  await Voter.updateOne(
    { voterId: v.voterId },
    { $set: { ...v, source: 'manual', createdBy: admin._id } },
    { upsert: true },
  );
}
const partyByCode = new Map((await Party.find({ code: { $in: PARTIES.map((p) => p.code) } }).lean()).map((p) => [p.code, p]));
const seatByCode = new Map((await Constituency.find({ code: { $in: SEATS.map((s) => s.code) } }).lean()).map((s) => [s.code, s]));

const now = Math.floor(Date.now() / 1000);
const chainStart = now + 60;
const end = now + 365 * 24 * 60 * 60;

const created = await relay.relayCreateElection(
  DEMO_TITLE,
  'Demo assembly election for testing app voting and polling-station voting.',
  '',
  chainStart,
  end,
  '',
);
const electionId = created.electionId;
if (!electionId) throw new Error('Could not read ElectionCreated event');

await Election.create({
  electionId,
  createdBy: admin._id,
  title: DEMO_TITLE,
  description: 'Demo assembly election for testing app voting and polling-station voting.',
  level: 'assembly',
  startTime: new Date(now * 1000),
  endTime: new Date(end * 1000),
  phase: 0,
  txHash: created.txHash,
  blockNumber: created.blockNumber,
  guardianApproved: false,
  pendingApproval: false,
});

for (const [i, c] of CANDIDATES.entries()) {
  const party = partyByCode.get(c.partyCode);
  const seat = seatByCode.get(c.seat);
  const { txHash, blockNumber, candidateId } = await relay.relayAddCandidate(
    electionId, c.name, party.name, party.symbol, c.manifesto, '', '',
  );
  await Candidate.create({
    electionId,
    candidateId: candidateId ?? i,
    name: c.name,
    party: party.name,
    partyId: party._id,
    partyCode: party.code,
    symbol: party.symbol,
    manifesto: c.manifesto,
    constituencyCode: seat.code,
    constituencyName: seat.name,
    state: seat.state,
    district: seat.district || '',
    txHash,
    blockNumber,
  });
}

for (const v of VOTERS) {
  const voter = await Voter.findOne({ voterId: v.voterId }).lean();
  const nullifierHash = computeNullifierHash(v.voterId, electionId);
  const { txHash } = await relay.relayRegisterVoter(electionId, nullifierHash);
  await Enrollment.create({
    electionId,
    voterId: v.voterId,
    voter: voter._id,
    constituencyCode: v.assemblyConstituency,
    nullifierHash,
    status: 'registered',
    registeredAt: new Date(),
    onChainTxHash: txHash,
  });
}

await relay.relayTransitionPhase(electionId, 1, '');
await Election.updateOne(
  { electionId },
  {
    phase: 1,
    candidateCount: CANDIDATES.length,
    guardianApproved: true,
    guardianApprovedAt: new Date(),
    guardianApprovedBy: 'demo-seed',
    enrollmentRules: [{ label: 'Demo seed', scope: { voterIds: VOTERS.map((v) => v.voterId) }, matched: VOTERS.length, enrolled: VOTERS.length, at: new Date() }],
  },
);

console.log(JSON.stringify({
  electionId,
  title: DEMO_TITLE,
  level: 'assembly',
  admin: { email: DEMO_ADMIN.email, password: DEMO_ADMIN.password },
  voters: VOTERS.map((v) => `${v.voterId} (${v.email}) → ${v.assemblyConstituency}`),
  candidates: CANDIDATES.map((c, i) => `${i}: ${c.name} [${c.partyCode}] in ${c.seat}`),
}, null, 2));
process.exit(0);
