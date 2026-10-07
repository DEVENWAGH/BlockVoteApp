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
import { ELECTION_LEVELS } from "@/lib/models/Election";

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

import { getAdminOrGuardian } from "@/lib/adminSession";

async function requireAdmin(req) {
  const result = await getAdminOrGuardian(req);
  if (!result?.ok) return null;
  return { adminId: result.adminId, name: result.name || "Guardian Authority", isGuardian: result.isGuardian };
}

export async function GET(req) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const orgName = admin?.name || "Guardian Authority";

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

    const dbElections = (admin.adminId === 'guardian_master' || String(admin.adminId).startsWith('guardian:'))
      ? await Election.find({}).lean()
      : await Election.find({ createdBy: admin.adminId }).lean();
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
          level: db.level || "general",
          candidateCount: db.candidateCount || 0,
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
    const admin = await requireAdmin(req);
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
      level: rawLevel = "general",
    } = await req.json();

    const level = ELECTION_LEVELS.includes(rawLevel) ? rawLevel : "general";
    const orgName = admin?.name || "admin";

    const rawStart = startTime || startDate;
    const rawEnd = endTime || endDate;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Title is required for the election" },
        { status: 400 },
      );
    }
    const finalDesc = description?.trim() || `${title.trim()} (${level})`;

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

    if (!rawStart) {
      start = now + 60;
    } else if (typeof rawStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawStart.trim())) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (rawStart.trim() <= todayStr) {
        start = now + 60;
      } else {
        start = Math.floor(new Date(`${rawStart.trim()}T07:00:00+05:30`).getTime() / 1000);
      }
    } else {
      start = Math.floor(new Date(rawStart).getTime() / 1000) || (now + 60);
    }

    if (!rawEnd) {
      end = now + 365 * 24 * 60 * 60;
    } else if (typeof rawEnd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawEnd.trim())) {
      end = Math.floor(new Date(`${rawEnd.trim()}T18:00:00+05:30`).getTime() / 1000);
    } else {
      end = Math.floor(new Date(rawEnd).getTime() / 1000) || (now + 365 * 24 * 60 * 60);
    }

    const GRACE_SECS = 2 * 60;
    if (start + GRACE_SECS <= now) {
      start = now + 60;
    }
    if (end <= start) {
      end = start + 365 * 24 * 60 * 60;
    }
    if (start <= now) start = now + 30;

    let ipfsCid = "";
    try {
      ipfsCid = await pinJSON(
        {
          type: "election-metadata",
          version: "1.1",
          title,
          description: finalDesc,
          level,
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
      await relayCreateElection(title, finalDesc, bannerUrl, start, end, "");

    if (!newElectionId) {
      return NextResponse.json(
        {
          error:
            "Election created on-chain but could not read election ID from event.",
        },
        { status: 500 },
      );
    }

    const isG = admin.isGuardian || admin.adminId === 'guardian_master' || String(admin.adminId).startsWith('guardian:');

    await Election.findOneAndUpdate(
      { electionId: newElectionId },
      {
        electionId: newElectionId,
        createdBy: admin.adminId,
        title,
        description: finalDesc,
        level,
        startTime: new Date(start * 1000),
        endTime: new Date(end * 1000),
        phase: isG ? 1 : 0,
        txHash,
        blockNumber,
        ipfsCid,
        guardianApproved: isG,
        guardianApprovedBy: isG ? String(admin.adminId) : '',
        guardianApprovedAt: isG ? new Date() : null,
        pendingApproval: false,
      },
      { upsert: true, returnDocument: "after" },
    );

    return NextResponse.json(
      {
        success: true,
        txHash,
        electionId: newElectionId,
        level,
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
