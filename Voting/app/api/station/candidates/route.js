import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Candidate from '@/lib/models/Candidate';
import Election from '@/lib/models/Election';
import Constituency from '@/lib/models/Constituency';
import Party from '@/lib/models/Party';
import { normalizeCode } from '@/lib/seats';

/**
 * GET /api/station/candidates?electionId=...&constituencyCode=...
 * Lists candidates standing for this station's seat (both approved and pending).
 */
export async function GET(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const electionId = searchParams.get('electionId');
    const constituencyCode = normalizeCode(searchParams.get('constituencyCode') || '');

    if (!electionId) {
      return NextResponse.json({ error: 'electionId is required' }, { status: 400 });
    }

    const filter = { electionId };
    if (constituencyCode) {
      filter.constituencyCode = constituencyCode;
    }

    const candidates = await Candidate.find(filter)
      .sort({ status: 1, candidateId: 1 })
      .lean();

    return NextResponse.json({ candidates });
  } catch (err) {
    console.error('Error fetching station candidates:', err);
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }
}

/**
 * POST /api/station/candidates
 * Polling station officers submit candidate nominations for their seat.
 * Candidate is saved with status: 'pending' to be approved by Guardians.
 */
export async function POST(req) {
  try {
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const {
      electionId,
      name,
      party,
      partyCode,
      constituencyCode,
      constituencyName,
      manifesto,
      symbol,
      stationName,
    } = body;

    if (!electionId) {
      return NextResponse.json({ error: 'electionId is required' }, { status: 400 });
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Candidate name is required' }, { status: 400 });
    }
    if (!party?.trim() && !partyCode?.trim()) {
      return NextResponse.json({ error: 'Party name or party code is required' }, { status: 400 });
    }

    const election = await Election.findOne({ electionId }).lean();
    if (!election) {
      return NextResponse.json({ error: 'Election not found' }, { status: 404 });
    }

    const normalizedPartyCode = normalizeCode(partyCode || party);
    const seatCode = normalizeCode(constituencyCode || '');

    let seatDoc = null;
    if (seatCode) {
      seatDoc = await Constituency.findOne({ code: seatCode }).lean();
    }

    // Lookup party record if exists to copy symbol
    let partyDoc = await Party.findOne({ code: normalizedPartyCode }).lean();
    if (!partyDoc && party) {
      partyDoc = await Party.findOne({ name: new RegExp(`^${party.trim()}$`, 'i') }).lean();
    }

    const finalSymbol = symbol || partyDoc?.symbol || '';
    const finalPartyName = partyDoc?.name || party || normalizedPartyCode;

    // Find next available candidateId for this election
    const highest = await Candidate.findOne({ electionId }).sort({ candidateId: -1 }).lean();
    const nextCandidateId = (highest?.candidateId || 0) + 1;

    const newCandidate = await Candidate.create({
      electionId,
      candidateId: nextCandidateId,
      name: name.trim(),
      party: finalPartyName,
      partyCode: normalizedPartyCode,
      partyId: partyDoc?._id || null,
      symbol: finalSymbol,
      manifesto: (manifesto || '').trim(),
      constituencyCode: seatCode,
      constituencyName: constituencyName || seatDoc?.name || seatCode,
      state: seatDoc?.state || '',
      district: seatDoc?.district || '',
      status: 'pending',
      nominatedBy: 'station',
      stationName: stationName || '',
    });

    return NextResponse.json({
      success: true,
      candidate: newCandidate,
      message: 'Candidate nomination submitted successfully. Awaiting Guardian approval.',
    });
  } catch (err) {
    console.error('Error nominating station candidate:', err);
    return NextResponse.json({ error: err.message || 'Failed to nominate candidate' }, { status: 500 });
  }
}
