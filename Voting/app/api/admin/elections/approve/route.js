/**
 * POST /api/admin/elections/approve
 * Guardian approves an election → transitions it on-chain from Registration → Voting
 * 
 * Body: { electionId, action: 'approve' | 'reject', issuedAt, signature }
 * The guardian wallet signs guardianActionMessage({ action: 'election:<action>', target: electionId }).
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import { relayTransitionPhase } from '@/lib/relay';
import Voter from '@/lib/models/Voter';
import Admin from '@/lib/models/Admin';
import { sendVoteInviteEmail } from '@/lib/mailer';
import { getVoteDeepLink, getVoteInviteUrl } from '@/lib/appLinks';
import { verifyGuardianAction } from '@/lib/guardianAuth';

export async function POST(req) {
  try {
    const { electionId, action, issuedAt, signature } = await req.json();

    if (electionId === undefined || electionId === null) {
      return NextResponse.json({ error: 'electionId is required' }, { status: 400 });
    }
    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
    }

    const guardian = await verifyGuardianAction({
      action: `election:${action}`,
      target: String(electionId),
      issuedAt,
      signature,
    });
    if (!guardian.ok) {
      return NextResponse.json({ error: guardian.error }, { status: 403 });
    }
    const guardianAddress = guardian.address;

    await connectDB();

    const electionDoc = await Election.findOne({ electionId: String(electionId) });
    if (!electionDoc) {
      return NextResponse.json({ error: 'Election not found' }, { status: 404 });
    }

    if (!electionDoc.pendingApproval && action === 'approve') {
      return NextResponse.json({ error: 'This election has not requested go-live approval' }, { status: 400 });
    }

    if (action === 'reject') {
      // Guardian rejects — reset the pending flag, stays in Registration
      await Election.findOneAndUpdate(
        { electionId: String(electionId) },
        { pendingApproval: false }
      );
      return NextResponse.json({
        success: true,
        message: 'Election go-live request rejected. It remains in Registration phase.',
      });
    }

    // ACTION: approve
    // Transition on-chain: Registration(0) → Voting(1)
    const { txHash } = await relayTransitionPhase(String(electionId), 1, electionDoc.orgSlug);

    // Update MongoDB
    await Election.findOneAndUpdate(
      { electionId: String(electionId) },
      {
        phase:              1,
        pendingApproval:    false,
        guardianApproved:   true,
        guardianApprovedBy: guardianAddress,
        guardianApprovedAt: new Date(),
      }
    );

    const adminDoc = electionDoc.createdBy
      ? await Admin.findById(electionDoc.createdBy).lean()
      : null;
    const orgName = adminDoc?.name || 'admin';
    const inviteUrl = getVoteInviteUrl(String(electionId), {
      orgName,
      electionTitle: electionDoc.title,
    });
    const deepLink = getVoteDeepLink(String(electionId));

    const voters = await Voter.find({
      electionId: String(electionId),
      status: 'registered',
      $or: [{ inviteSentAt: null }, { inviteSentAt: { $exists: false } }],
    }).limit(500);

    let invitesSent = 0;
    for (const voter of voters) {
      try {
        await sendVoteInviteEmail(voter.email, {
          voterName: voter.name,
          electionTitle: electionDoc.title,
          inviteUrl,
          deepLink,
        });
        await Voter.findByIdAndUpdate(voter._id, { inviteSentAt: new Date() });
        invitesSent++;
      } catch (inviteErr) {
        console.warn('[admin/elections/approve] invite failed', voter.email, inviteErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      txHash,
      invitesSent,
      message: `Election #${electionId} approved and is now LIVE for voters!`,
    });
  } catch (err) {
    console.error('[admin/elections/approve POST]', err);
    return NextResponse.json({ error: err.message || 'Approval failed' }, { status: 500 });
  }
}
