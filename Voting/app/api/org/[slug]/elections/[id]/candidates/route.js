/**
 * GET/POST candidates for an election (admin web + mobile GET).
 * Path keeps legacy /api/org/[slug]/... shape; slug is ignored.
 */
import { NextResponse } from "next/server";
import { ethers } from "ethers";
import connectDB from "@/lib/db";
import Election from "@/lib/models/Election";
import { relayAddCandidate } from "@/lib/relay";
import { pinJSON, getIPFSUrl } from "@/lib/ipfs";
import { isAllowedAssetUrl, resolveAssetUrl } from '@/lib/urlUtils';
import { getRequestOrigin } from '@/lib/s3';
import { auth } from '@/auth';
import { getRpcUrl } from '@/lib/serverEnv';

async function getReadContract() {
  const abi = (
    await import("@/lib/contracts/VotingV1.json", { assert: { type: "json" } })
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

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const electionId = id;

    await connectDB();
    const electionDoc = await Election.findOne({ electionId });
    if (!electionDoc) {
      return NextResponse.json({ error: "Election not found" }, { status: 404 });
    }

    const contract = await getReadContract();
    const rawCandidates = await contract.getCandidates(electionId);
    const origin = getRequestOrigin(req);
    const candidates = rawCandidates.map((c) => ({
      id: Number(c.id),
      name: c.name,
      party: c.party,
      symbol: resolveAssetUrl(c.symbol, origin),
      manifesto: c.manifesto,
      photoUrl: resolveAssetUrl(c.photoUrl, origin),
      voteCount: Number(c.voteCount),
    }));

    return NextResponse.json({ candidates });
  } catch (err) {
    console.error("[candidates GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch candidates" },
      { status: 500 },
    );
  }
}

export async function POST(req, { params }) {
  try {
    const session = await auth();
    if (!session?.user?.adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const electionId = id;
    const {
      name,
      party,
      symbol,
      manifesto = "",
      photoUrl = "",
    } = await req.json();

    if (!name?.trim())
      return NextResponse.json(
        { error: "Candidate name is required" },
        { status: 400 },
      );
    if (!party?.trim())
      return NextResponse.json(
        { error: "Party / affiliation is required" },
        { status: 400 },
      );
    if (!isAllowedAssetUrl(symbol))
      return NextResponse.json(
        { error: "Party symbol image is required — upload a symbol image." },
        { status: 400 },
      );

    const origin = getRequestOrigin(req);
    const symbolUrl = resolveAssetUrl(symbol.trim(), origin);
    const photoUrlResolved = photoUrl ? resolveAssetUrl(photoUrl.trim(), origin) : '';

    await connectDB();
    const electionDoc = await Election.findOne({ electionId });
    if (!electionDoc) {
      return NextResponse.json({ error: "Election not found" }, { status: 404 });
    }
    if (
      electionDoc.createdBy &&
      String(electionDoc.createdBy) !== String(session.user.adminId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (electionDoc.phase !== 0) {
      return NextResponse.json(
        { error: "Candidates can only be added during Registration phase" },
        { status: 400 },
      );
    }

    const { txHash } = await relayAddCandidate(
      electionId,
      name.trim(),
      party.trim(),
      symbolUrl,
      manifesto,
      photoUrlResolved,
      "",
    );

    let ipfsCid = "";
    try {
      ipfsCid = await pinJSON(
        {
          type: "candidate-metadata",
          version: "1.0",
          electionId,
          name: name.trim(),
          party: party.trim(),
          symbol: symbolUrl,
          manifesto,
          photoUrl: photoUrlResolved,
          txHash,
          pinnedAt: new Date().toISOString(),
        },
        `candidate-${electionId.slice(0, 10)}-${name.trim().replace(/\s+/g, "-")}`,
        { electionId: String(electionId), type: "candidate" },
      );
    } catch (ipfsErr) {
      console.warn("[candidates POST] IPFS pin failed:", ipfsErr.message);
    }

    await Election.findOneAndUpdate(
      { electionId },
      { $inc: { candidateCount: 1 } },
    );

    return NextResponse.json({
      success: true,
      txHash,
      ipfsCid,
      ipfsUrl: getIPFSUrl(ipfsCid),
    });
  } catch (err) {
    console.error("[candidates POST]", err);
    return NextResponse.json(
      { error: err.message || "Failed to add candidate" },
      { status: 500 },
    );
  }
}
