import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Candidate from '@/lib/models/Candidate';
import { getAdminOrGuardian } from '@/lib/adminSession';

/**
 * POST /api/admin/candidates/approve
 * Approves or Rejects a station-nominated candidate.
 * Body: { candidateMongoId, action: 'approve' | 'reject' }
 */
export async function POST(req) {
  try {
    const authResult = await getAdminOrGuardian(req).catch(() => null);
    const body = await req.json().catch(() => ({}));
    const { candidateMongoId, action } = body;

    if (!candidateMongoId) {
      return NextResponse.json({ error: 'candidateMongoId is required' }, { status: 400 });
    }
    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be approve or reject' }, { status: 400 });
    }

    await connectDB();
    const candidate = await Candidate.findById(candidateMongoId);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    candidate.status = action === 'approve' ? 'approved' : 'rejected';
    candidate.approvedBy = authResult?.adminId || 'guardian_authority';
    candidate.approvedAt = new Date();
    await candidate.save();

    return NextResponse.json({
      success: true,
      status: candidate.status,
      message: `Candidate nomination ${action === 'approve' ? 'approved and added to ballot' : 'rejected'}.`,
    });
  } catch (err) {
    console.error('Error approving candidate:', err);
    return NextResponse.json({ error: err.message || 'Failed to update candidate status' }, { status: 500 });
  }
}
