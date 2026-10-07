/**
 * GET /api/booths?electionId=...  — booths started for an election, with how
 * many ballots were cast at each (admin).
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Booth from '@/lib/models/Booth';
import Enrollment from '@/lib/models/Enrollment';
import { auth } from '@/auth';

import { getAdminOrGuardian } from '@/lib/adminSession';

export async function GET(req) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const electionId = searchParams.get('electionId');
    if (!electionId) return NextResponse.json({ error: 'electionId is required' }, { status: 400 });

    await connectDB();
    const [booths, votes] = await Promise.all([
      Booth.find({ electionId: String(electionId) }).sort({ lastActivatedAt: -1 }).lean(),
      Enrollment.aggregate([
        { $match: { electionId: String(electionId), votedAtBoothId: { $ne: '' } } },
        { $group: { _id: '$votedAtBoothId', ballots: { $sum: 1 } } },
      ]),
    ]);
    const ballotsByBooth = new Map(votes.map((v) => [String(v._id), v.ballots]));
    return NextResponse.json({
      booths: booths.map((b) => ({
        _id: b._id,
        code: b.code,
        name: b.name,
        state: b.state,
        district: b.district,
        address: b.address,
        lastActivatedAt: b.lastActivatedAt,
        activations: b.activations || 0,
        ballots: ballotsByBooth.get(String(b._id)) || 0,
      })),
    });
  } catch (err) {
    console.error('[booths GET]', err);
    return NextResponse.json({ error: 'Failed to load booths' }, { status: 500 });
  }
}
