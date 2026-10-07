/**
 * Enroll people from the master roll into an election, by place.
 *
 * GET  /api/elections/[id]/enroll              — summary + rules used so far (admin)
 * POST /api/elections/[id]/enroll
 *      { scope: { state?, district?, city?, village?, ward?, constituencyCode?, voterIds? }, preview? }
 *      preview=true only counts matches. Otherwise enrolls and registers a
 *      first batch on-chain; call /api/voters/bulk-register for the rest.
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import Voter from '@/lib/models/Voter';
import Enrollment from '@/lib/models/Enrollment';
import Constituency from '@/lib/models/Constituency';
import { auth } from '@/auth';
import {
  buildScopeFilter,
  describeScope,
  enrollVotersByScope,
  registerPendingEnrollments,
  enrollmentSummary,
} from '@/lib/enrollment';

import { getAdminOrGuardian } from '@/lib/adminSession';

const FIRST_BATCH_ON_CHAIN = 25;

async function loadOwnedElection(id, adminId) {
  const election = await Election.findOne({ electionId: String(id) }).lean();
  if (!election) return { error: NextResponse.json({ error: 'Election not found' }, { status: 404 }) };
  if (election.createdBy && String(election.createdBy) !== String(adminId) && adminId !== 'guardian_master' && !String(adminId).startsWith('guardian:')) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { election };
}

export async function GET(req, { params }) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const { id } = await params;
    const { election, error } = await loadOwnedElection(id, authResult.adminId);
    if (error) return error;

    const summary = await enrollmentSummary(election.electionId);
    const seatRows = await Enrollment.aggregate([
      { $match: { electionId: election.electionId } },
      { $group: { _id: '$constituencyCode', voters: { $sum: 1 }, registered: { $sum: { $cond: [{ $eq: ['$status', 'registered'] }, 1, 0] } }, voted: { $sum: { $cond: [{ $gt: ['$votesCast', 0] }, 1, 0] } } } },
      { $sort: { voters: -1 } },
    ]);
    const codes = seatRows.map((r) => r._id).filter(Boolean);
    const seats = codes.length ? await Constituency.find({ code: { $in: codes } }).select('code name level state district').lean() : [];
    const seatByCode = new Map(seats.map((s) => [s.code, s]));
    const bySeat = seatRows.map((r) => ({
      code: r._id || '',
      name: seatByCode.get(r._id)?.name || (r._id ? r._id : 'Everyone (single ballot)'),
      state: seatByCode.get(r._id)?.state || '',
      district: seatByCode.get(r._id)?.district || '',
      voters: r.voters,
      registered: r.registered,
      voted: r.voted,
    }));

    return NextResponse.json({
      summary,
      bySeat,
      rules: election.enrollmentRules || [],
      level: election.level || 'general',
    });
  } catch (err) {
    console.error('[enroll GET]', err);
    return NextResponse.json({ error: 'Failed to load enrollment' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const { id } = await params;
    const { election, error } = await loadOwnedElection(id, authResult.adminId);
    if (error) return error;

    if (election.phase === 2) {
      return NextResponse.json({ error: 'This election has closed.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const scope = body.scope && typeof body.scope === 'object' ? body.scope : {};
    const preview = body.preview === true;

    const hasAny = Object.values(scope).some((v) => (Array.isArray(v) ? v.length : String(v || '').trim()));
    if (!hasAny && !body.everyone) {
      return NextResponse.json(
        { error: 'Choose a place (state, district, city, village or seat) or tick "everyone on the roll".' },
        { status: 400 },
      );
    }

    const filter = buildScopeFilter(scope);
    const matched = await Voter.countDocuments(filter);
    if (preview) {
      const alreadyEnrolled = matched
        ? await Enrollment.countDocuments({ electionId: election.electionId, voterId: { $in: (await Voter.find(filter).select('voterId').limit(50_000).lean()).map((v) => v.voterId) } })
        : 0;
      return NextResponse.json({ preview: true, label: describeScope(scope), matched, alreadyEnrolled });
    }

    const result = await enrollVotersByScope({ election, scope, adminId: session.user.adminId });
    await Election.updateOne(
      { electionId: election.electionId },
      {
        $push: {
          enrollmentRules: {
            label: `Include voters in ${describeScope(scope)}`,
            scope,
            matched: result.matched,
            enrolled: result.enrolled,
            skippedCases: result.skippedCases,
            at: new Date(),
          },
        },
      },
    );

    const registration = await registerPendingEnrollments(election.electionId, { limit: FIRST_BATCH_ON_CHAIN });
    const summary = await enrollmentSummary(election.electionId);

    return NextResponse.json({
      success: true,
      label: describeScope(scope),
      ...result,
      registration,
      summary,
      message: `${result.enrolled.toLocaleString()} added from ${describeScope(scope)}. ${result.alreadyEnrolled ? `${result.alreadyEnrolled} were already in.` : ''}${result.skippedCases ? ` ${result.skippedCases} skipped — waiting for a guardian.` : ''}${result.noSeat ? ` ${result.noSeat} skipped — no matching seat.` : ''}`.trim(),
    });
  } catch (err) {
    console.error('[enroll POST]', err);
    return NextResponse.json({ error: err.message || 'Enrollment failed' }, { status: 500 });
  }
}
