/**
 * GET /api/elections/public — live elections for discovery (no org tenancy).
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import '@/lib/models/Admin';
import { ethers } from 'ethers';
import { getRpcUrl } from '@/lib/serverEnv';

async function getReadContract() {
  const abi = (
    await import('@/lib/contracts/VotingV1.json', { assert: { type: 'json' } })
  ).default.abi;
  const provider = new ethers.JsonRpcProvider(
    getRpcUrl(),
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
      guardianApproved: true,
      phase: { $in: [0, 1, 2] },
    })
      .sort({ createdAt: -1 })
      .populate({ path: 'createdBy', select: 'name' })
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
      const orgName = e.createdBy?.name || 'admin';
      const electionName = e.title;
      const basePath = `/org/${encodeURIComponent(orgName)}/election/${encodeURIComponent(
        electionName,
      )}/${encodeURIComponent(e.electionId)}`;
      const c = chainMap[e.electionId] || {};
      return {
        id: e.electionId,
        electionId: e.electionId,
        orgName,
        title: c.title || e.title,
        description: c.description || e.description,
        bannerUrl: c.bannerUrl || '',
        startTime: c.startTime || Math.floor(new Date(e.startTime).getTime() / 1000),
        endTime: c.endTime || Math.floor(new Date(e.endTime).getTime() / 1000),
        phase: c.phase ?? e.phase,
        guardianApproved: true,
        inviteUrl: basePath,
      };
    });

    return NextResponse.json({ elections });
  } catch (err) {
    console.error('[elections/public]', err);
    return NextResponse.json({ error: 'Failed to list elections' }, { status: 500 });
  }
}
