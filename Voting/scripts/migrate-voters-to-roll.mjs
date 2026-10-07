/**
 * One-time migration: old per-election `voters` rows → master roll + enrollments.
 *
 *   node scripts/migrate-voters-to-roll.mjs            (dry run — prints what would change)
 *   node scripts/migrate-voters-to-roll.mjs --apply    (writes)
 *
 * Old rows had { electionId, email, status, nullifierHash, votesCast, ... } and no voterId.
 * For each old row:
 *   - the person is added to the master roll once (voterId = "LEGACY-" + short hash of email)
 *   - an Enrollment is created for that election, keeping the old nullifier so the
 *     existing on-chain registration (keccak(email:secret)) still works
 *   - the old row is replaced by the master-roll row (same collection)
 * Run /api/admin/fix-indexes afterwards to drop the old per-election indexes.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['.env.development.local', '.env.local', '.env.development', '.env']) {
  const p = path.join(ROOT, file);
  if (fs.existsSync(p)) process.loadEnvFile(p);
}

const APPLY = process.argv.includes('--apply');

const { default: mongoose } = await import('mongoose');
const { default: connectDB } = await import('../lib/db.js');
const { default: Voter } = await import('../lib/models/Voter.js');
const { default: Enrollment } = await import('../lib/models/Enrollment.js');

await connectDB();
const raw = mongoose.connection.db.collection('voters');

const legacy = await raw.find({ electionId: { $exists: true, $ne: null }, voterId: { $exists: false } }).toArray();
console.log(`${legacy.length} legacy per-election voter row(s) found${APPLY ? '' : ' (dry run)'}`);

function legacyVoterId(email) {
  return `LEGACY${crypto.createHash('sha256').update(String(email).toLowerCase().trim()).digest('hex').slice(0, 10).toUpperCase()}`;
}

const people = new Map();
const enrollments = [];
for (const row of legacy) {
  const email = String(row.email || '').toLowerCase().trim();
  if (!email) continue;
  const voterId = legacyVoterId(email);
  if (!people.has(voterId)) {
    people.set(voterId, {
      voterId,
      name: row.name || email,
      email,
      phone: row.phone || '',
      gender: row.gender || '',
      age: row.age ?? null,
      state: row.state || row.region || '',
      district: '',
      city: row.city || '',
      village: row.village || '',
      localityType: row.localityType || '',
      cityTier: row.cityTier || '',
      source: 'migration',
      createdAt: row.createdAt || new Date(),
      updatedAt: new Date(),
    });
  }
  enrollments.push({
    electionId: String(row.electionId),
    voterId,
    constituencyCode: '',
    nullifierHash: row.nullifierHash || '',
    status: row.status || 'pending',
    registeredAt: row.registeredAt || null,
    onChainTxHash: row.onChainTxHash || '',
    rejectionReason: row.rejectionReason || '',
    inviteSentAt: row.inviteSentAt || null,
    votesCast: row.votesCast || 0,
    stationVoteFinal: row.stationVoteFinal === true,
    castLockUntil: null,
    createdAt: row.createdAt || new Date(),
    updatedAt: new Date(),
  });
}

console.log(`→ ${people.size} people on the master roll, ${enrollments.length} enrollment(s)`);

if (!APPLY) {
  for (const p of [...people.values()].slice(0, 5)) console.log('  person', p.voterId, p.email);
  console.log('Re-run with --apply to write.');
  process.exit(0);
}

for (const e of enrollments) {
  await Enrollment.updateOne({ electionId: e.electionId, voterId: e.voterId }, { $setOnInsert: e }, { upsert: true });
}
for (const p of people.values()) {
  const person = people.get(p.voterId);
  const doc = await Voter.findOne({ voterId: p.voterId }).lean();
  if (!doc) await Voter.collection.insertOne(person);
}
const removed = await raw.deleteMany({ _id: { $in: legacy.map((r) => r._id) } });
console.log(`Done. Removed ${removed.deletedCount} legacy row(s). Now call GET /api/admin/fix-indexes once.`);
process.exit(0);
