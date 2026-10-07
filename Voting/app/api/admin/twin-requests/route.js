import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import BiometricHash from '@/lib/models/BiometricHash';
import Enrollment from '@/lib/models/Enrollment';
import Voter from '@/lib/models/Voter';

/** nullifierHash → { name, email, voterId } for one election. */
async function identityMap(electionId, extraNullifiers = []) {
  const enrollments = await Enrollment.find(
    { $or: [{ electionId }, { nullifierHash: { $in: extraNullifiers } }] },
    { voterId: 1, nullifierHash: 1 },
  ).lean();
  const voterIds = [...new Set(enrollments.map((e) => e.voterId))];
  const people = await Voter.find({ voterId: { $in: voterIds } }).select('voterId name email').lean();
  const personById = new Map(people.map((p) => [p.voterId, p]));
  const map = new Map();
  for (const e of enrollments) {
    if (!e.nullifierHash) continue;
    const p = personById.get(e.voterId);
    map.set(e.nullifierHash, { name: p?.name || '', email: p?.email || '', voterId: e.voterId });
  }
  return map;
}

// GET /api/admin/twin-requests?electionId=...
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const electionId = searchParams.get('electionId');

    if (!electionId) {
      return NextResponse.json({ error: 'electionId is required.' }, { status: 400 });
    }

    await connectDB();

    const directRecords = await BiometricHash.find({ electionId, twinVerificationStatus: { $ne: 'none' } }).lean();

    const enrolledNullifiers = (
      await Enrollment.find({ electionId }, { nullifierHash: 1 }).lean()
    ).map((e) => e.nullifierHash).filter(Boolean);

    let legacyRecords = [];
    if (enrolledNullifiers.length > 0) {
      const directNullifiers = new Set(directRecords.map((r) => r.nullifierHash));
      legacyRecords = await BiometricHash.find({
        nullifierHash: { $in: enrolledNullifiers, $nin: [...directNullifiers] },
        twinVerificationStatus: { $ne: 'none' },
      }).lean();
    }

    const allRecordsMap = new Map();
    for (const r of [...directRecords, ...legacyRecords]) {
      if (!allRecordsMap.has(r.nullifierHash)) allRecordsMap.set(r.nullifierHash, r);
    }
    const allRecords = [...allRecordsMap.values()];

    const matchedNullifiers = allRecords.map((r) => r.twinMatchedNullifier).filter(Boolean);
    const identities = await identityMap(electionId, [...allRecords.map((r) => r.nullifierHash), ...matchedNullifiers]);

    const requests = allRecords.map((record) => {
      const voter = identities.get(record.nullifierHash);
      const matched = record.twinMatchedNullifier ? identities.get(record.twinMatchedNullifier) : null;
      return {
        id: record._id,
        nullifierHash: record.nullifierHash,
        name: voter?.name || 'Unknown Voter',
        email: voter?.email || 'Unknown Email',
        voterId: voter?.voterId || '',
        twinVerificationStatus: record.twinVerificationStatus,
        bypassDuplicateCheck: record.bypassDuplicateCheck,
        twinMatchedNullifier: record.twinMatchedNullifier,
        twinMatchedEmail: matched?.email || record.twinMatchedEmail || 'Unknown',
        twinMatchedName: matched?.name || 'Unknown',
        twinMatchSimilarity: record.twinMatchSimilarity,
        twinNotes: record.twinNotes || '',
        updatedAt: record.updatedAt,
      };
    });

    return NextResponse.json({ success: true, requests });
  } catch (err) {
    console.error('[admin/twin-requests] GET Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch twin requests.' }, { status: 500 });
  }
}

// POST /api/admin/twin-requests
// Body: { nullifierHash, action: 'approve' | 'reject', notes }
export async function POST(req) {
  try {
    const { nullifierHash, action, notes } = await req.json();

    if (!nullifierHash) {
      return NextResponse.json({ error: 'nullifierHash is required.' }, { status: 400 });
    }
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be approve or reject.' }, { status: 400 });
    }

    await connectDB();

    const record = await BiometricHash.findOne({ nullifierHash });
    if (!record) {
      return NextResponse.json({ error: 'Biometric record not found.' }, { status: 404 });
    }

    if (action === 'approve') {
      record.bypassDuplicateCheck = true;
      record.twinVerificationStatus = 'approved';
    } else {
      record.bypassDuplicateCheck = false;
      record.twinVerificationStatus = 'rejected';
    }

    record.twinNotes = notes || `Manually ${action}d by administrator.`;
    await record.save();

    return NextResponse.json({
      success: true,
      message: `Twin request successfully ${action}d.`,
      record: {
        nullifierHash: record.nullifierHash,
        twinVerificationStatus: record.twinVerificationStatus,
        bypassDuplicateCheck: record.bypassDuplicateCheck,
      }
    });
  } catch (err) {
    console.error('[admin/twin-requests] POST Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update twin request.' }, { status: 500 });
  }
}
