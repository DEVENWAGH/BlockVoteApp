import { NextResponse } from 'next/server';
import { hasInternalKey } from '@/lib/internalAuth';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import Candidate from '@/lib/models/Candidate';
import Admin from '@/lib/models/Admin';
import { getVotingWindowStatus } from '@/lib/votingWindow';

import mongoose from 'mongoose';

// GET /api/elections/:id  — single election with its candidates
export async function GET(request, { params }) {
  try {
    await connectDB();
    const { id } = await params;

    const isObjId = mongoose.Types.ObjectId.isValid(id);
    const election = await Election.findOne({
      $or: [{ electionId: id }, ...(isObjId ? [{ _id: id }] : [])]
    }).lean();

    if (!election)
      return NextResponse.json({ success: false, error: 'Election not found' }, { status: 404 });

    const candidates = await Candidate.find({ electionId: election.electionId })
      .sort({ candidateId: 1 })
      .lean();

    const admin = election.createdBy
      ? await Admin.findById(election.createdBy).select('name').lean()
      : null;

    return NextResponse.json({
      success: true,
      data: {
        ...election,
        orgName: admin?.name || '',
        canonicalVoteUrl: admin?.name
          ? `/org/${encodeURIComponent(admin.name)}/election/${encodeURIComponent(
              election.title,
            )}/${encodeURIComponent(election.electionId)}`
          : '',
        candidates,
        votingWindow: getVotingWindowStatus(election),
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH /api/elections/:id  — update phase (called by event listener)
export async function PATCH(request, { params }) {
  if (!hasInternalKey(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    const election = await Election.findOneAndUpdate(
      { electionId: id },
      { $set: body },
      { returnDocument: 'after' }
    );
    if (!election)
      return NextResponse.json({ success: false, error: 'Election not found' }, { status: 404 });

    return NextResponse.json({ success: true, data: election });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
