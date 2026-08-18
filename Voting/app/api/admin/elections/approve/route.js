/**
 * POST /api/admin/elections/approve
 * Guardian approves an election → transitions it on-chain from Registration → Voting
 * 
 * Body: { electionId: number, guardianAddress: string, action: 'approve' | 'reject' }
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import { relayTransitionPhase } from '@/lib/relay';
import Voter from '@/lib/models/Voter';
import Admin from '@/lib/models/Admin';
import { sendVoteInviteEmail } from '@/lib/mailer';
import { getVoteDeepLink, getVoteInviteUrl, getWebPortalUrl } from '@/lib/appLinks';

export async function POST(req) {
  try {
    const { electionId, guardianAddress, action } = await req.json();

    if (electionId === undefined || electionId === null) {
      return NextResponse.json({ error: 'electionId is required' }, { status: 400 });
    }
    if (!guardianAddress) {
      return NextResponse.json({ error: 'guardianAddress is required' }, { status: 400 });
    }
    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
    }

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
    const portalUrl = getWebPortalUrl(String(electionId), {
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
          portalUrl,
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
