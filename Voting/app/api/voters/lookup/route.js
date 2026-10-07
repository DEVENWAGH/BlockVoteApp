/**
 * GET /api/voters/lookup?voterId=ABC1234567&electionId=0x...
 * (email=... still accepted for rows migrated from the old per-election roster)
 *
 * Returns the voter slip: masked identity, home place and the seat whose
 * candidates this person will see — regardless of which booth they are at.
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import { rateLimit } from '@/lib/rateLimit';
import { findVoterAndEnrollment, hasOpenCase, seatForEnrollment, ensureEnrollmentNullifier } from '@/lib/enrollment';
import { maskVoterId, maskEmail } from '@/lib/voterIdentity';
import { describeSeat, usesSeatFiltering } from '@/lib/seats';
import { VOTER_MESSAGES } from '@/lib/voterMessages';

const lookupLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  keyPrefix: 'voter-lookup',
  message: 'Too many lookup requests. Please try again later.',
});

export async function GET(request) {
  const limited = lookupLimiter(request);
  if (limited) return limited;

  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const voterId = searchParams.get('voterId');
    const email = searchParams.get('email');
    const electionId = searchParams.get('electionId');

    if (!voterId && !email) {
      return NextResponse.json({ error: 'voterId is required.' }, { status: 400 });
    }
    if (!electionId) {
      return NextResponse.json({ error: 'electionId is required.' }, { status: 400 });
    }

    const election = await Election.findOne({ electionId: String(electionId) }).lean();
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
    if (enrollment.status === 'rejected') {
      return NextResponse.json({ error: VOTER_MESSAGES.REJECTED, code: 'REJECTED' }, { status: 409 });
    }

    const nullifierHash = ensureEnrollmentNullifier(enrollment, electionId);
    if (enrollment.isModified?.()) await enrollment.save();

    const seat = await seatForEnrollment(enrollment);
    const filtered = usesSeatFiltering(election);

    return NextResponse.json({
      success: true,
      memberId: voter.voterId,
      nullifierHash,
      status: enrollment.status,
      slip: {
        voterId: voter.voterId,
        maskedVoterId: maskVoterId(voter.voterId),
        name: voter.name,
        maskedEmail: maskEmail(voter.email),
        homePlace: [voter.village || voter.city, voter.district, voter.state].filter(Boolean).join(', '),
        village: voter.village,
        city: voter.city,
        district: voter.district,
        state: voter.state,
        ward: voter.ward,
        homePollingStation: voter.homePollingStation,
        constituencyCode: enrollment.constituencyCode || '',
        constituencyName: seat ? describeSeat(seat, election.level) : filtered ? '' : election.title,
        level: election.level || 'general',
        hasVoted: (enrollment.votesCast || 0) > 0,
        stationVoteFinal: enrollment.stationVoteFinal === true,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
