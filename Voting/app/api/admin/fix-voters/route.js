/**
 * POST /api/admin/fix-voters
 * Resets on-chain registration state for enrollments so they can be
 * re-registered (for example after the nullifier formula changed to
 * voterId:electionId:secret).
 *
 * Body: { confirm: true, electionId? }
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Enrollment from '@/lib/models/Enrollment';
import { auth } from '@/auth';
import { computeNullifierHash } from '@/lib/voterIdentity';

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { confirm, electionId } = await req.json();
    if (!confirm) {
      return NextResponse.json({ error: 'Send { confirm: true } to proceed' }, { status: 400 });
    }

    await connectDB();

    const scope = electionId ? { electionId: String(electionId) } : {};
    const cursor = Enrollment.find({ ...scope, status: { $in: ['registered', 'rejected'] } }).cursor();

    let reset = 0;
    for await (const enrollment of cursor) {
      enrollment.status = 'pending';
      enrollment.nullifierHash = computeNullifierHash(enrollment.voterId, enrollment.electionId);
      enrollment.onChainTxHash = '';
      enrollment.registeredAt = null;
      enrollment.rejectionReason = '';
      await enrollment.save();
      reset += 1;
    }

    return NextResponse.json({
      success: true,
      message: `${reset} enrollment(s) reset to pending. Run "Register waiting voters" for each election.`,
      reset,
    });
  } catch (err) {
    console.error('[admin/fix-voters]', err);
    return NextResponse.json({ error: err.message || 'Reset failed' }, { status: 500 });
  }
}
