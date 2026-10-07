/**
 * GET  /api/admin/elections  — list elections pending guardian approval
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import Admin from '@/lib/models/Admin';
import { electionChecklist } from '@/lib/checklist';
import { LEVEL_SHORT } from '@/lib/seats';

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

    const GO_LIVE_APPROVAL_THRESHOLD = 1;

    // The checklist is only needed for elections waiting on a guardian.
    const checklists = new Map();
    if (filter === 'pending') {
      await Promise.all(
        elections.map(async (e) => {
          try {
            checklists.set(e.electionId, await electionChecklist(e));
          } catch (err) {
            console.warn('[admin/elections] checklist failed', e.electionId, err.message);
          }
        }),
      );
    }

    const enriched = elections.map(e => {
      const admin = e.createdBy ? adminMap[String(e.createdBy)] : null;
      const approvedBy = e.guardianApprovedBy ? [e.guardianApprovedBy] : [];
      return {
        ...e,
        id: e.electionId,
        level: e.level || 'general',
        levelLabel: LEVEL_SHORT[e.level || 'general'],
        approvalThreshold: GO_LIVE_APPROVAL_THRESHOLD,
        approvedBy,
        approvalsCount: approvedBy.length,
        checklist: checklists.get(e.electionId) || null,
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

import { getAdminOrGuardian } from '@/lib/adminSession';

export async function PATCH(req) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { electionId, level, title } = await req.json();
    if (!electionId) {
      return NextResponse.json({ error: 'electionId is required' }, { status: 400 });
    }

    await connectDB();
    const update = {};
    if (level) update.level = level;
    if (title) update.title = title;

    const doc = await Election.findOneAndUpdate(
      { electionId },
      { $set: update },
      { new: true }
    ).lean();

    if (!doc) {
      return NextResponse.json({ error: 'Election not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, election: doc });
  } catch (err) {
    console.error('[admin/elections PATCH]', err);
    return NextResponse.json({ error: err.message || 'Failed to update election' }, { status: 500 });
  }
}
