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
import { sendInvitesForElection } from '@/lib/invites';
import { electionChecklist } from '@/lib/checklist';

import { getAdminOrGuardian } from '@/lib/adminSession';

export async function POST(req, { params }) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) {
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
      String(electionDoc.createdBy) !== String(authResult.adminId) &&
      authResult.adminId !== 'guardian_master' &&
      !String(authResult.adminId).startsWith('guardian:')
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
      const checklist = await electionChecklist(electionDoc);
      if (!checklist.ready) {
        const blockers = checklist.items.filter((i) => !i.ok).map((i) => i.label);
        return NextResponse.json(
          { error: `Finish the checklist first: ${blockers.join('; ')}.`, checklist },
          { status: 400 },
        );
      }

      await Election.findOneAndUpdate(
        { electionId },
        { pendingApproval: true }
      );

      return NextResponse.json({
        success: true,
        checklist,
        message: 'Sent to the guardians. Voting opens once a guardian approves.',
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
      const sent = await sendInvitesForElection({
        electionId,
        electionTitle: electionDoc.title,
        inviteUrl,
        deepLink,
        onlyUnsent: false,
        limit: 500,
        send: sendVoteInviteEmail,
      });
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
