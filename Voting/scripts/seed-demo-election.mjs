/**
 * Seeds a live demo election on the local Hardhat chain + MongoDB for manual testing.
 *
 *   node scripts/seed-demo-election.mjs
 *
 * Creates (or reuses) a demo admin, creates a fresh election on-chain, adds candidates,
 * registers the demo voters and opens voting. Re-running replaces the previous demo election.
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

const CANDIDATES = [
  { name: 'Asha Patil', party: 'Progress Party', manifesto: 'Better public transport and parks.' },
  { name: 'Rohan Mehta', party: 'Unity Front', manifesto: 'Digital services for every ward.' },
  { name: 'Neha Kulkarni', party: 'Green Alliance', manifesto: 'Clean water and solar schools.' },
];

const VOTERS = [
  { name: 'App Demo Voter', email: 'demo.app@blockvote.local' },
  { name: 'Station Demo Voter', email: 'demo.station@blockvote.local' },
  { name: 'Rules Test Voter', email: 'demo.rules@blockvote.local' },
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
    Voter.deleteMany({ electionId: { $in: oldIds } }),
    EmailOTP.deleteMany({ electionId: { $in: oldIds } }),
  ]);
}

const now = Math.floor(Date.now() / 1000);
const chainStart = now + 60;
const end = now + 7 * 24 * 60 * 60;

const created = await relay.relayCreateElection(
  DEMO_TITLE,
  'Demo election for testing app voting and polling-station voting.',
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
  description: 'Demo election for testing app voting and polling-station voting.',
  startTime: new Date(now * 1000),
  endTime: new Date(end * 1000),
  phase: 0,
  txHash: created.txHash,
  blockNumber: created.blockNumber,
  guardianApproved: false,
  pendingApproval: false,
});

for (const [i, c] of CANDIDATES.entries()) {
  const symbol = `${ASSET_ORIGIN}/logo.png`;
  const { txHash, blockNumber } = await relay.relayAddCandidate(
    electionId, c.name, c.party, symbol, c.manifesto, '', '',
  );
  await Candidate.create({
    electionId, candidateId: i, name: c.name, party: c.party, symbol,
    manifesto: c.manifesto, txHash, blockNumber,
  });
}

for (const v of VOTERS) {
  const nullifierHash = computeNullifierHash(v.email);
  const { txHash } = await relay.relayRegisterVoter(electionId, nullifierHash);
  await Voter.create({
    electionId, name: v.name, email: v.email, nullifierHash,
    status: 'registered', registeredAt: new Date(), onChainTxHash: txHash,
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
  },
);

console.log(JSON.stringify({
  electionId,
  title: DEMO_TITLE,
  admin: { email: DEMO_ADMIN.email, password: DEMO_ADMIN.password },
  voters: VOTERS.map((v) => v.email),
  candidates: CANDIDATES.map((c, i) => `${i}: ${c.name}`),
}, null, 2));
process.exit(0);
