/**
 * POST /api/voters/bulk-register
 * Manual fallback if CSV auto-registration missed some voters.
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';
import { relayRegisterVoter, resetRelayNonce, isVoterRegisteredOnChain } from '@/lib/relay';
import { computeNullifierHash, isAlreadyRegisteredError } from '@/lib/voterIdentity';
import { auth } from '@/auth';

async function linkExistingVoter(voter, nullifierHash) {
  await Voter.findByIdAndUpdate(voter._id, {
    status: 'registered',
    nullifierHash,
    registeredAt: new Date(),
    onChainTxHash: 'linked-existing',
    rejectionReason: '',
  });
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { electionId } = await req.json();
    if (electionId == null || electionId === '') {
      return NextResponse.json({ error: 'electionId is required' }, { status: 400 });
    }

    await connectDB();

    const eid = String(electionId);
    const votersToRegister = await Voter.find({
      electionId: eid,
      $or: [
        { status: 'pending' },
        { status: 'rejected', rejectionReason: /already registered|transaction execution reverted/i },
      ],
    });
    if (votersToRegister.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending voters to register', registered: 0 });
    }

    resetRelayNonce();

    let registered = 0;
    let linked = 0;
    let failed = 0;
    const failedVoters = [];

    for (const voter of votersToRegister) {
      const label = voter.memberId || voter.email;
      let success = false;
      const nullifierHash = computeNullifierHash(voter.email);

      try {
        if (await isVoterRegisteredOnChain(eid, nullifierHash)) {
          await linkExistingVoter(voter, nullifierHash);
          linked++;
          continue;
        }
      } catch (checkErr) {
        console.warn(`[bulk-register] on-chain check failed for ${label}:`, checkErr.message);
      }

      for (let attempt = 0; attempt < 3 && !success; attempt++) {
        try {
          const { txHash } = await relayRegisterVoter(eid, nullifierHash);
          await Voter.findByIdAndUpdate(voter._id, {
            status: 'registered',
            nullifierHash,
            registeredAt: new Date(),
            onChainTxHash: txHash,
            rejectionReason: '',
          });
          registered++;
          success = true;
        } catch (regErr) {
          if (isAlreadyRegisteredError(regErr)) {
            await linkExistingVoter(voter, nullifierHash);
            linked++;
            success = true;
          } else if (attempt === 2) {
            await Voter.findByIdAndUpdate(voter._id, {
              status: 'rejected',
              nullifierHash,
              rejectionReason: regErr.message,
            });
            failedVoters.push(label);
            failed++;
          } else {
            resetRelayNonce();
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      registered,
      linked,
      failed,
      failedVoters,
      message: `${registered} registered, ${linked} linked, ${failed} failed.`,
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
    const pending = await Voter.countDocuments({ electionId: String(electionId), status: 'pending' });
    return NextResponse.json({ pending });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
