/**
 * GET /api/voters/list?electionId=...
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';
import { auth } from '@/auth';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const electionIdRaw = searchParams.get('electionId');
    const status     = searchParams.get('status') || 'all';
    const page       = Math.max(1, parseInt(searchParams.get('page')  || '1', 10));
    const limit      = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)));

    if (electionIdRaw == null || electionIdRaw === '') {
      return NextResponse.json({ error: 'electionId is required' }, { status: 400 });
    }
    const electionId = String(electionIdRaw).trim();

    await connectDB();

    const baseFilter = { electionId };
    const filter = { ...baseFilter };
    if (status !== 'all') filter.status = status;

    const [voters, total] = await Promise.all([
      Voter.find(filter)
        .select('name email phone gender age status registeredAt onChainTxHash rejectionReason inviteSentAt createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Voter.countDocuments(filter),
    ]);

    const [pending, registered, rejected] = await Promise.all([
      Voter.countDocuments({ ...baseFilter, status: 'pending' }),
      Voter.countDocuments({ ...baseFilter, status: 'registered' }),
      Voter.countDocuments({ ...baseFilter, status: 'rejected' }),
    ]);

    return NextResponse.json({
      voters,
      total,
      page,
      pages: Math.ceil(total / limit),
      counts: { pending, registered, rejected, total: pending + registered + rejected },
    });
  } catch (err) {
    console.error('[voters/list]', err);
    return NextResponse.json({ error: 'Failed to fetch voters' }, { status: 500 });
  }
}
