/**
 * GET /api/elections/public — live elections for discovery (no org tenancy).
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import { ethers } from 'ethers';

async function getReadContract() {
  const abi = (
    await import('@/lib/contracts/VotingV1.json', { assert: { type: 'json' } })
  ).default.abi;
  const provider = new ethers.JsonRpcProvider(
    process.env.RPC_URL || 'http://127.0.0.1:8545',
  );
  return new ethers.Contract(
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
    abi,
    provider,
  );
}

export async function GET() {
  try {
    await connectDB();

    const dbElections = await Election.find({
      phase: 1,
      guardianApproved: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    let onChain = [];
    try {
      const contract = await getReadContract();
      const raw = await contract.getAllElections();
      onChain = raw.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        bannerUrl: e.bannerUrl,
        startTime: Number(e.startTime),
        endTime: Number(e.endTime),
        phase: Number(e.phase),
      }));
    } catch {
      // chain optional for listing
    }

    const chainMap = Object.fromEntries(onChain.map((e) => [e.id, e]));
    const elections = dbElections.map((e) => {
      const c = chainMap[e.electionId] || {};
      return {
        id: e.electionId,
        title: c.title || e.title,
        description: c.description || e.description,
        bannerUrl: c.bannerUrl || '',
        startTime: c.startTime || Math.floor(new Date(e.startTime).getTime() / 1000),
        endTime: c.endTime || Math.floor(new Date(e.endTime).getTime() / 1000),
        phase: c.phase ?? e.phase,
        guardianApproved: true,
        inviteUrl: `/go/${e.electionId}`,
      };
    });

    return NextResponse.json({ elections });
  } catch (err) {
    console.error('[elections/public]', err);
    return NextResponse.json({ error: 'Failed to list elections' }, { status: 500 });
  }
}
