/**
 * GET  /api/admin/elections  — list elections pending guardian approval
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import Admin from '@/lib/models/Admin';

export async function GET(req) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'pending'; // pending | all | completed

    let query = {};
    if (filter === 'pending') {
      query = { pendingApproval: true, guardianApproved: false };
    } else if (filter === 'completed') {
      query = { phase: 2 };
    }

    const elections = await Election.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const adminIds = [...new Set(elections.map(e => e.createdBy).filter(Boolean).map(String))];
    const admins = adminIds.length
      ? await Admin.find({ _id: { $in: adminIds } }).lean()
      : [];
    const adminMap = {};
    for (const a of admins) adminMap[String(a._id)] = a;

    const enriched = elections.map(e => {
      const admin = e.createdBy ? adminMap[String(e.createdBy)] : null;
      return {
        ...e,
        id: e.electionId,
        org: {
          name: admin?.name || 'Admin',
          email: admin?.email || '',
        },
      };
    });

    return NextResponse.json({ elections: enriched });
  } catch (err) {
    console.error('[admin/elections GET]', err);
    return NextResponse.json({ error: 'Failed to fetch elections' }, { status: 500 });
  }
}
