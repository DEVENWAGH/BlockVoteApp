/**
 * GET   /api/voters/roll/[voterId]  — one person + their enrollments (admin)
 * PATCH /api/voters/roll/[voterId]  — fix details on the master roll (admin).
 *        Changing the home seat does NOT move existing enrollments in open elections;
 *        re-run "Include voters" for that election.
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';
import Enrollment from '@/lib/models/Enrollment';
import Election from '@/lib/models/Election';
import VoterCase from '@/lib/models/VoterCase';
import Constituency from '@/lib/models/Constituency';
import { auth } from '@/auth';
import { normalizeVoterId } from '@/lib/voterIdentity';
import { normalizeRollRow, validateRollRow, COMPARE_FIELDS } from '@/lib/rollValidation';

export async function GET(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const { voterId } = await params;
    const id = normalizeVoterId(voterId);
    const voter = await Voter.findOne({ voterId: id }).lean();
    if (!voter) return NextResponse.json({ error: 'Voter not found' }, { status: 404 });

    const enrollments = await Enrollment.find({ voterId: id }).lean();
    const elections = enrollments.length
      ? await Election.find({ electionId: { $in: enrollments.map((e) => e.electionId) } }).select('electionId title level phase').lean()
      : [];
    const titleById = new Map(elections.map((e) => [e.electionId, e]));
    const cases = await VoterCase.find({ status: 'open', $or: [{ 'newRow.voterId': id }, { existingVoterId: id }] }).lean();

    return NextResponse.json({
      voter,
      enrollments: enrollments.map((e) => ({
        electionId: e.electionId,
        title: titleById.get(e.electionId)?.title || '',
        level: titleById.get(e.electionId)?.level || 'general',
        phase: titleById.get(e.electionId)?.phase ?? null,
        constituencyCode: e.constituencyCode,
        status: e.status,
        votesCast: e.votesCast || 0,
        votedAtBoothName: e.votedAtBoothName || '',
        votedAt: e.votedAt,
      })),
      openCases: cases,
    });
  } catch (err) {
    console.error('[voters/roll/[id] GET]', err);
    return NextResponse.json({ error: 'Failed to load voter' }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const { voterId } = await params;
    const id = normalizeVoterId(voterId);
    const voter = await Voter.findOne({ voterId: id });
    if (!voter) return NextResponse.json({ error: 'Voter not found' }, { status: 404 });

    const body = await req.json();
    const merged = normalizeRollRow({ ...voter.toObject(), ...body, voterId: id });
    const seatCodes = new Set((await Constituency.find({}, { code: 1 }).lean()).map((s) => s.code));
    const validation = validateRollRow(merged, { seatCodes });
    if (!validation.ok) return NextResponse.json({ error: validation.reasons.join(' ') }, { status: 400 });

    if (merged.email !== voter.email) {
      const other = await Voter.findOne({ email: merged.email, voterId: { $ne: id } }).lean();
      if (other) return NextResponse.json({ error: `Email is already used by voter ID ${other.voterId}.` }, { status: 409 });
    }

    for (const field of COMPARE_FIELDS) voter[field] = merged[field];
    voter.localityType = merged.localityType;
    voter.cityTier = merged.cityTier;
    await voter.save();

    return NextResponse.json({ success: true, voter });
  } catch (err) {
    console.error('[voters/roll/[id] PATCH]', err);
    return NextResponse.json({ error: err.message || 'Could not update voter' }, { status: 500 });
  }
}
