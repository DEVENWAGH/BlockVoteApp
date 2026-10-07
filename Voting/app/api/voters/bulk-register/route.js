/**
 * POST /api/voters/bulk-register  { electionId, limit? }
 * Register pending enrollments on-chain (batches of up to 100 per call).
 * GET  /api/voters/bulk-register?electionId=...  → { pending }
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Enrollment from '@/lib/models/Enrollment';
import { resetRelayNonce } from '@/lib/relay';
import { registerPendingEnrollments } from '@/lib/enrollment';
import { auth } from '@/auth';

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { electionId, limit } = await req.json();
    if (electionId == null || electionId === '') {
      return NextResponse.json({ error: 'electionId is required' }, { status: 400 });
    }

    await connectDB();
    const eid = String(electionId);

    // Retry rows that failed for transient reasons.
    await Enrollment.updateMany(
      { electionId: eid, status: 'rejected', rejectionReason: /already registered|transaction execution reverted|nonce|timeout/i },
      { $set: { status: 'pending', rejectionReason: '' } },
    );

    const pendingCount = await Enrollment.countDocuments({ electionId: eid, status: 'pending' });
    if (pendingCount === 0) {
      return NextResponse.json({ success: true, message: 'No pending voters to register', registered: 0, linked: 0, failed: 0, remaining: 0 });
    }

    resetRelayNonce();
    const batch = Math.min(100, Math.max(1, Number(limit) || 50));
    const result = await registerPendingEnrollments(eid, { limit: batch });

    return NextResponse.json({
      success: true,
      ...result,
      message: `${result.registered} registered, ${result.linked} linked, ${result.failed} failed. ${result.remaining} still waiting.`,
    });
  } catch (err) {
    console.error('[bulk-register]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const electionId = searchParams.get('electionId');
    if (!electionId) {
      return NextResponse.json({ error: 'electionId is required' }, { status: 400 });
    }
    await connectDB();
    const pending = await Enrollment.countDocuments({ electionId: String(electionId), status: 'pending' });
    return NextResponse.json({ pending });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
