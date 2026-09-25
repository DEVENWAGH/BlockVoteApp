/**
 * POST /api/org/[slug]/elections/[id]/phase
 * Admin phase actions (slug ignored — org concept removed).
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import { relayTransitionPhase } from '@/lib/relay';
import { auth } from '@/auth';
import { getVoteDeepLink, getVoteInviteUrl } from '@/lib/appLinks';
import { sendVoteInviteEmail } from '@/lib/mailer';
import Voter from '@/lib/models/Voter';

export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const electionId = id;
    const { action } = await req.json();

    if (!action) return NextResponse.json({ error: 'action is required' }, { status: 400 });

    await connectDB();
    const electionDoc = await Election.findOne({ electionId });
    if (!electionDoc) {
      return NextResponse.json({ error: 'Election not found' }, { status: 404 });
    }
    if (
      electionDoc.createdBy &&
      String(electionDoc.createdBy) !== String(session.user.adminId)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (action === 'request-live') {
      if (electionDoc.phase !== 0) {
        return NextResponse.json({ error: 'Election must be in Registration phase to request go-live' }, { status: 400 });
      }
      if (electionDoc.pendingApproval) {
        return NextResponse.json({ error: 'Go-live approval is already pending' }, { status: 400 });
      }
      if (electionDoc.guardianApproved) {
        return NextResponse.json({ error: 'Election is already approved and live' }, { status: 400 });
      }
      if ((electionDoc.candidateCount || 0) < 1) {
        return NextResponse.json({ error: 'Add at least 1 candidate before requesting go-live' }, { status: 400 });
      }

      await Election.findOneAndUpdate(
        { electionId },
        { pendingApproval: true }
      );

      return NextResponse.json({
        success: true,
        message: 'Go-live request submitted. A Guardian must approve before the election goes live.',
      });
    }

    if (action === 'end-election') {
      if (electionDoc.phase !== 1) {
        return NextResponse.json({ error: 'Election must be in Voting phase to end it' }, { status: 400 });
      }

      const { txHash } = await relayTransitionPhase(electionId, 2, '');

      await Election.findOneAndUpdate(
        { electionId },
        { phase: 2, guardianApproved: false }
      );

      return NextResponse.json({ success: true, txHash, message: 'Election ended. Results are now public.' });
    }

    if (action === 'resend-invites') {
      const orgName = session?.user?.name || session?.user?.email || 'admin';
      const inviteUrl = getVoteInviteUrl(electionId, { orgName, electionTitle: electionDoc.title });
      const deepLink = getVoteDeepLink(electionId);
      const voters = await Voter.find({ electionId, status: 'registered' }).limit(500);
      let sent = 0;
      for (const voter of voters) {
        try {
          await sendVoteInviteEmail(voter.email, {
            voterName: voter.name,
            electionTitle: electionDoc.title,
            inviteUrl,
            deepLink,
          });
          await Voter.findByIdAndUpdate(voter._id, { inviteSentAt: new Date() });
          sent++;
        } catch (e) {
          console.warn('[phase] invite failed', voter.email, e.message);
        }
      }
      return NextResponse.json({
        success: true,
        sent,
        inviteUrl,
        deepLink,
        message: `Sent ${sent} app invite emails.`,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error('[phase POST]', err);
    return NextResponse.json({ error: err.message || 'Phase change failed' }, { status: 500 });
  }
}
