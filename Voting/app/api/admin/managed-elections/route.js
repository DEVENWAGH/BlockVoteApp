/**
 * Admin election management (web).
 * GET  — list elections created by the signed-in admin
 * POST — create election on-chain + Mongo
 *
 * Also keeps legacy path /api/org/[slug]/elections working (slug ignored).
 */
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Election from "@/lib/models/Election";
import { relayCreateElection } from "@/lib/relay";
import { pinJSON, getIPFSUrl } from "@/lib/ipfs";
import { ethers } from "ethers";
import { auth } from "@/auth";
import { getVoteDeepLink, getVoteInviteUrl } from "@/lib/appLinks";
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

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.adminId) return null;
  return session.user;
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const orgName = admin?.name || "admin";

    let onChainElections = [];
    try {
      const contract = await getReadContract();
      const raw = await contract.getAllElections();
      onChainElections = raw.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        bannerUrl: e.bannerUrl,
        startTime: Number(e.startTime),
        endTime: Number(e.endTime),
        phase: Number(e.phase),
      }));
    } catch (contractErr) {
      if (
        contractErr.code === "BAD_DATA" ||
        contractErr.code === "CALL_EXCEPTION"
      ) {
        console.warn("[managed-elections GET] Contract unavailable");
      } else {
        throw contractErr;
      }
    }

    const dbElections = await Election.find({ createdBy: admin.adminId }).lean();
    const dbMap = {};
    for (const e of dbElections) {
      dbMap[e.electionId] = e;
    }

    const ownedIds = new Set(dbElections.map((e) => e.electionId));
    const elections = onChainElections
      .filter((e) => ownedIds.has(e.id))
      .map((e) => {
        const db = dbMap[e.id] || {};
        return {
          ...e,
          _id: db._id,
          guardianApproved: db.guardianApproved || false,
          pendingApproval: db.pendingApproval || false,
          guardianApprovedBy: db.guardianApprovedBy || "",
          guardianApprovedAt: db.guardianApprovedAt || null,
          ipfsCid: db.ipfsCid || "",
          inviteUrl: getVoteInviteUrl(e.id, { orgName, electionTitle: e.title }),
          deepLink: getVoteDeepLink(e.id),
        };
      });

    return NextResponse.json({ elections });
  } catch (err) {
    console.error("[managed-elections GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch elections" },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      title,
      description,
      bannerUrl = "",
      startTime,
      endTime,
      startDate,
      endDate,
    } = await req.json();

    const orgName = admin?.name || "admin";

    const rawStart = startTime || startDate;
    const rawEnd = endTime || endDate;

    if (!title || !description || !rawStart || !rawEnd) {
      return NextResponse.json(
        { error: "title, description, start date, and end date are required" },
        { status: 400 },
      );
    }

    await connectDB();

    const existingByTitle = await Election.findOne({
      createdBy: admin.adminId,
      title: { $regex: new RegExp(`^${title.trim()}$`, "i") },
    }).lean();
    if (existingByTitle) {
      return NextResponse.json(
        { error: `An election named "${title}" already exists` },
        { status: 409 },
      );
    }

    const now = Math.floor(Date.now() / 1000);
    let start, end;

    // If pure date format (YYYY-MM-DD), align start to now + 60s (if today/past) or 7:00 AM IST
    if (typeof rawStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawStart.trim())) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (rawStart.trim() <= todayStr) {
        start = now + 60;
      } else {
        start = Math.floor(new Date(`${rawStart.trim()}T07:00:00+05:30`).getTime() / 1000);
      }
    } else {
      start = Math.floor(new Date(rawStart).getTime() / 1000);
    }

    // If pure date format (YYYY-MM-DD), align end to 18:00 (6:00 PM) IST on that day
    if (typeof rawEnd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawEnd.trim())) {
      end = Math.floor(new Date(`${rawEnd.trim()}T18:00:00+05:30`).getTime() / 1000);
    } else {
      end = Math.floor(new Date(rawEnd).getTime() / 1000);
    }

    const GRACE_SECS = 2 * 60;
    if (start + GRACE_SECS <= now) {
      start = now + 60;
    }
    if (end <= start) {
      return NextResponse.json(
        { error: "End date must be after start date" },
        { status: 400 },
      );
    }
    if (start <= now) start = now + 30;

    let ipfsCid = "";
    try {
      ipfsCid = await pinJSON(
        {
          type: "election-metadata",
          version: "1.0",
          title,
          description,
          bannerUrl,
          startTime: new Date(start * 1000).toISOString(),
          endTime: new Date(end * 1000).toISOString(),
          pinnedAt: new Date().toISOString(),
        },
        `election-${Date.now()}`,
        { type: "election", adminId: admin.adminId },
      );
    } catch (ipfsErr) {
      console.warn("[managed-elections POST] IPFS pin failed:", ipfsErr.message);
    }

    const { txHash, blockNumber, electionId: newElectionId } =
      await relayCreateElection(title, description, bannerUrl, start, end, "");

    if (!newElectionId) {
      return NextResponse.json(
        {
          error:
            "Election created on-chain but could not read election ID from event.",
        },
        { status: 500 },
      );
    }

    await Election.findOneAndUpdate(
      { electionId: newElectionId },
      {
        electionId: newElectionId,
        createdBy: admin.adminId,
        title,
        description,
        startTime: new Date(start * 1000),
        endTime: new Date(end * 1000),
        phase: 0,
        txHash,
        blockNumber,
        ipfsCid,
        guardianApproved: false,
        pendingApproval: false,
      },
      { upsert: true, returnDocument: "after" },
    );

    return NextResponse.json(
      {
        success: true,
        txHash,
        electionId: newElectionId,
        ipfsCid,
        ipfsUrl: getIPFSUrl(ipfsCid),
        inviteUrl: getVoteInviteUrl(newElectionId, { orgName, electionTitle: title }),
        deepLink: getVoteDeepLink(newElectionId),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[managed-elections POST]", err);
    return NextResponse.json(
      { error: err.message || "Failed to create election" },
      { status: 500 },
    );
  }
}
