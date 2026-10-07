import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Candidate from '@/lib/models/Candidate';
import Election from '@/lib/models/Election';
import { getAdminOrGuardian } from '@/lib/adminSession';

/**
 * GET /api/admin/candidates/pending
 * Returns all candidate nominations submitted by stations awaiting Guardian approval.
 */
export async function GET(req) {
  try {
    const authResult = await getAdminOrGuardian(req).catch(() => null);
    if (!authResult?.isGuardian && authResult?.adminId !== 'guardian_master') {
      // Allow guardians to access
    }

    await connectDB();
    const pendingCandidates = await Candidate.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .lean();

    // Map election titles
    const electionIds = [...new Set(pendingCandidates.map((c) => c.electionId))];
    const elections = await Election.find({ electionId: { $in: electionIds } }, { electionId: 1, title: 1 }).lean();
    const electionTitleMap = new Map(elections.map((e) => [e.electionId, e.title]));

    const formatted = pendingCandidates.map((c) => ({
      _id: String(c._id),
      candidateId: c.candidateId,
      name: c.name,
      party: c.party,
      partyCode: c.partyCode,
      symbol: c.symbol,
      manifesto: c.manifesto,
      constituencyCode: c.constituencyCode,
      constituencyName: c.constituencyName,
      state: c.state,
      district: c.district,
      stationName: c.stationName,
      electionId: c.electionId,
      electionTitle: electionTitleMap.get(c.electionId) || 'Election',
      status: c.status,
      createdAt: c.createdAt,
    }));

    return NextResponse.json({ candidates: formatted });
  } catch (err) {
    console.error('Error fetching pending candidates:', err);
    return NextResponse.json({ error: 'Failed to fetch pending candidates' }, { status: 500 });
  }
}
