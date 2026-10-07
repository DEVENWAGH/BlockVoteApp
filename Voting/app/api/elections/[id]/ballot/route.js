/**
 * GET /api/elections/[id]/ballot?voterId=ABC1234567
 *
 * The voter's HOME ballot: only the candidates standing in the seat that the
 * master roll says this person belongs to — no matter which booth or city
 * they are in. Symbol-first, plain language.
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import Candidate from '@/lib/models/Candidate';
import { rateLimit } from '@/lib/rateLimit';
import { getRequestOrigin } from '@/lib/s3';
import { findVoterAndEnrollment, hasOpenCase, seatForEnrollment } from '@/lib/enrollment';
import { serializeCandidates } from '@/lib/ballot';
import { describeSeat, usesSeatFiltering } from '@/lib/seats';
import { maskVoterId } from '@/lib/voterIdentity';
import { VOTER_MESSAGES, phaseLabel } from '@/lib/voterMessages';

const ballotLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyPrefix: 'ballot',
  message: 'Too many requests. Please wait a moment.',
});

export async function GET(request, { params }) {
  const limited = ballotLimiter(request);
  if (limited) return limited;

  try {
    await connectDB();
    const { id } = await params;
    const electionId = String(id);
    const { searchParams } = new URL(request.url);
    const voterId = searchParams.get('voterId');
    const email = searchParams.get('email');

    if (!voterId && !email) {
      return NextResponse.json({ error: 'voterId is required.' }, { status: 400 });
    }

    const election = await Election.findOne({ electionId }).lean();
    if (!election) {
      return NextResponse.json({ error: 'Election not found.' }, { status: 404 });
    }

    const { voter, enrollment } = await findVoterAndEnrollment({ electionId, voterId, email });
    if (!voter) {
      return NextResponse.json({ error: VOTER_MESSAGES.NOT_ON_LIST, code: 'NOT_ON_LIST' }, { status: 404 });
    }
    if (!enrollment) {
      return NextResponse.json({ error: VOTER_MESSAGES.NOT_ENROLLED, code: 'NOT_ENROLLED' }, { status: 404 });
    }
    if (await hasOpenCase(voter.voterId)) {
      return NextResponse.json({ error: VOTER_MESSAGES.CASE_OPEN, code: 'CASE_OPEN' }, { status: 409 });
    }

    const filtered = usesSeatFiltering(election);
    const filter = { electionId, status: { $nin: ['pending', 'rejected'] } };
    if (filtered) filter.constituencyCode = enrollment.constituencyCode || '__none__';

    const docs = await Candidate.find(filter).sort({ candidateId: 1 }).lean();
    const origin = getRequestOrigin(request);
    const candidates = await serializeCandidates(docs, origin);
    const seat = await seatForEnrollment(enrollment);

    return NextResponse.json({
      success: true,
      election: {
        electionId,
        title: election.title,
        level: election.level || 'general',
        phase: election.phase,
        status: phaseLabel(election.phase),
        open: election.phase === 1 && election.guardianApproved === true,
      },
      seat: {
        code: enrollment.constituencyCode || '',
        name: seat ? describeSeat(seat, election.level) : filtered ? '' : election.title,
        homePlace: [voter.village || voter.city, voter.district, voter.state].filter(Boolean).join(', '),
      },
      voter: {
        maskedVoterId: maskVoterId(voter.voterId),
        name: voter.name,
      },
      candidates,
      message: candidates.length === 0 ? VOTER_MESSAGES.NO_CANDIDATES : '',
    });
  } catch (err) {
    console.error('[ballot GET]', err);
    return NextResponse.json({ error: 'Could not load the ballot. Please try again.' }, { status: 500 });
  }
}
