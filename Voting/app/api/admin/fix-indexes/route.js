/**
 * GET /api/admin/fix-indexes
 * One-time migration: drops stale indexes on the voters collection left by
 * older schema versions (per-election roster), then syncs the current
 * master-roll + enrollment indexes.
 * Requires a signed-in election admin.
 */
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';
import Enrollment from '@/lib/models/Enrollment';
import Party from '@/lib/models/Party';
import Constituency from '@/lib/models/Constituency';
import Booth from '@/lib/models/Booth';
import VoterCase from '@/lib/models/VoterCase';
import Candidate from '@/lib/models/Candidate';

// Indexes that existed in old schema versions of `voters` — must be removed
const STALE_VOTER_INDEXES = [
  'orgId_1_memberId_1',
  'orgId_1_email_1',
  'orgSlug_1_email_1',
  'orgSlug_1_electionId_1_nullifierHash_1',
  'nullifierHash_1',
  'memberId_1',
  'electionId_1_email_1',        // per-election roster — the roll is now one row per person
  'electionId_1_status_1',
  'electionId_1_nullifierHash_1',
  'electionId_1',
  'email_1',                     // email is no longer unique — voterId is
];

async function dropStale(collection, names, dropped, notFound) {
  const existing = (await collection.indexes()).map((i) => i.name);
  for (const name of names) {
    if (!existing.includes(name)) {
      notFound.push(name);
      continue;
    }
    try {
      await collection.dropIndex(name);
      dropped.push(name);
    } catch (e) {
      console.warn(`[fix-indexes] Could not drop ${name}:`, e.message);
    }
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const dropped = [];
    const notFound = [];

    await dropStale(Voter.collection, STALE_VOTER_INDEXES, dropped, notFound);

    // A unique index on email (from the very first schema) blocks the master
    // roll where households may share one email. Drop it if it is unique.
    const voterIdx = await Voter.collection.indexes();
    for (const idx of voterIdx) {
      if (idx.unique && idx.name !== '_id_' && idx.name !== 'voterId_1') {
        try {
          await Voter.collection.dropIndex(idx.name);
          dropped.push(`${idx.name} (unique, legacy)`);
        } catch (e) {
          console.warn(`[fix-indexes] Could not drop ${idx.name}:`, e.message);
        }
      }
    }

    const synced = {};
    for (const [name, model] of Object.entries({
      voters: Voter,
      enrollments: Enrollment,
      parties: Party,
      constituencies: Constituency,
      booths: Booth,
      votercases: VoterCase,
      candidates: Candidate,
    })) {
      try {
        await model.syncIndexes();
        synced[name] = (await model.collection.indexes()).map((i) => ({
          name: i.name,
          key: i.key,
          unique: i.unique ?? false,
        }));
      } catch (e) {
        synced[name] = { error: e.message };
      }
    }

    return NextResponse.json({ success: true, dropped, notFound, indexes: synced });
  } catch (err) {
    console.error('[fix-indexes] ERROR:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
