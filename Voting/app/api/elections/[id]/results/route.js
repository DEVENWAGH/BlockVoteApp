import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import Candidate from '@/lib/models/Candidate';
import Constituency from '@/lib/models/Constituency';
import { usesSeatFiltering } from '@/lib/seats';

// GET /api/elections/:id/results
// For seat-based elections, results are grouped per constituency with a winner each.
export async function GET(request, { params }) {
  try {
    await connectDB();
    const { id } = await params;

    const election = await Election.findOne({ electionId: id }).lean();
    if (!election)
      return NextResponse.json({ success: false, error: 'Election not found' }, { status: 404 });

    if (election.phase !== 2)
      return NextResponse.json(
        { success: false, error: 'Results only available after election is completed' },
        { status: 400 }
      );

    const candidates = await Candidate.find({ electionId: id })
      .sort({ voteCount: -1 })
      .lean();

    const winner = candidates[0] ?? null;
    const totalVotes = candidates.reduce((sum, c) => sum + (c.voteCount || 0), 0);

    let bySeat = [];
    if (usesSeatFiltering(election)) {
      const groups = new Map();
      for (const c of candidates) {
        const code = c.constituencyCode || '';
        if (!groups.has(code)) groups.set(code, []);
        groups.get(code).push(c);
      }
      const seats = await Constituency.find({ code: { $in: [...groups.keys()].filter(Boolean) } }).lean();
      const seatByCode = new Map(seats.map((s) => [s.code, s]));
      bySeat = [...groups.entries()].map(([code, list]) => {
        const sorted = [...list].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
        return {
          code,
          name: seatByCode.get(code)?.name || code,
          state: seatByCode.get(code)?.state || '',
          district: seatByCode.get(code)?.district || '',
          totalVotes: sorted.reduce((s, c) => s + (c.voteCount || 0), 0),
          winner: sorted[0] ?? null,
          candidates: sorted,
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
    }

    return NextResponse.json({ success: true, data: { election, candidates, winner, totalVotes, bySeat } });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
