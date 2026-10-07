/**
 * GET/POST candidates for an election (admin web + mobile GET).
 * Path keeps legacy /api/org/[slug]/... shape; slug is ignored.
 *
 * GET  ?constituencyCode=  — candidates (from Mongo, with live party symbol);
 *                            falls back to the chain for elections created before
 *                            candidates were mirrored in Mongo.
 * POST { name, partyId | partyCode, constituencyCode?, manifesto?, photoUrl? }
 *      The symbol is copied from the Party record — never uploaded here.
 *      One candidate per party per seat (unless the party allows many).
 */
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Election from "@/lib/models/Election";
import Candidate from "@/lib/models/Candidate";
import Party from "@/lib/models/Party";
import Constituency from "@/lib/models/Constituency";
import { relayAddCandidate, getReadContract } from "@/lib/relay";
import { pinJSON, getIPFSUrl } from "@/lib/ipfs";
import { resolveAssetUrl } from '@/lib/urlUtils';
import { getRequestOrigin } from '@/lib/s3';
import { auth } from '@/auth';
import { usesSeatFiltering, normalizeCode } from '@/lib/seats';
import { serializeCandidates } from '@/lib/ballot';

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const electionId = id;
    const { searchParams } = new URL(req.url);
    const seatCode = normalizeCode(searchParams.get('constituencyCode') || '');

    await connectDB();
    const electionDoc = await Election.findOne({ electionId }).lean();
    if (!electionDoc) {
      return NextResponse.json({ error: "Election not found" }, { status: 404 });
    }

    const origin = getRequestOrigin(req);
    const filter = { electionId };
    if (seatCode) filter.constituencyCode = seatCode;
    const docs = await Candidate.find(filter).sort({ constituencyCode: 1, candidateId: 1 }).lean();

    if (docs.length > 0 || seatCode) {
      const candidates = await serializeCandidates(docs, origin);
      return NextResponse.json({ candidates, level: electionDoc.level || 'general' });
    }

    // Legacy: chain-only candidates
    const rawCandidates = await getReadContract().getCandidates(electionId);
    const candidates = rawCandidates.map((c) => ({
      id: Number(c.id),
      candidateId: Number(c.id),
      name: c.name,
      party: c.party,
      partyCode: '',
      symbol: resolveAssetUrl(c.symbol, origin),
      manifesto: c.manifesto,
      photoUrl: resolveAssetUrl(c.photoUrl, origin),
      voteCount: Number(c.voteCount),
      constituencyCode: '',
      constituencyName: '',
    }));

    return NextResponse.json({ candidates, level: electionDoc.level || 'general' });
  } catch (err) {
    console.error("[candidates GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch candidates" },
      { status: 500 },
    );
  }
}

import { getAdminOrGuardian } from '@/lib/adminSession';

export async function POST(req, { params }) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const electionId = id;
    const {
      name,
      partyId,
      partyCode,
      constituencyCode,
      manifesto = "",
      photoUrl = "",
    } = await req.json();

    if (!name?.trim())
      return NextResponse.json({ error: "Candidate name is required" }, { status: 400 });
    if (!partyId && !partyCode)
      return NextResponse.json({ error: "Choose a party from the list" }, { status: 400 });

    await connectDB();
    const electionDoc = await Election.findOne({ electionId });
    if (!electionDoc) {
      return NextResponse.json({ error: "Election not found" }, { status: 404 });
    }
    if (electionDoc.createdBy && !authResult.isGuardian && String(electionDoc.createdBy) !== String(authResult.adminId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (electionDoc.phase !== 0 && !authResult.isGuardian) {
      return NextResponse.json(
        { error: "Candidates can only be added before voting opens" },
        { status: 400 },
      );
    }

    const party = partyId
      ? await Party.findById(partyId).lean()
      : await Party.findOne({ code: normalizeCode(partyCode) }).lean();
    if (!party) {
      return NextResponse.json({ error: "Party not found. Add it under Parties first." }, { status: 404 });
    }

    const filtered = usesSeatFiltering(electionDoc);
    const seatCode = normalizeCode(constituencyCode || '');
    let seat = null;
    if (filtered) {
      if (!seatCode) {
        return NextResponse.json({ error: "Choose the seat this candidate stands in" }, { status: 400 });
      }
      seat = await Constituency.findOne({ code: seatCode }).lean();
      if (!seat) {
        return NextResponse.json({ error: `Seat "${seatCode}" is not in the seat list` }, { status: 404 });
      }
      if (seat.level !== electionDoc.level) {
        return NextResponse.json(
          { error: `"${seat.name}" is a ${seat.level} seat; this is a ${electionDoc.level} election` },
          { status: 400 },
        );
      }
    }

    if (!party.allowMultiplePerSeat) {
      const clash = await Candidate.findOne({
        electionId,
        partyCode: party.code,
        constituencyCode: filtered ? seatCode : '',
      }).lean();
      if (clash) {
        return NextResponse.json(
          {
            error: filtered
              ? `${party.name} already has a candidate (${clash.name}) in ${seat?.name || seatCode}.`
              : `${party.name} already has a candidate (${clash.name}) in this election.`,
          },
          { status: 409 },
        );
      }
    }

    const origin = getRequestOrigin(req);
    const symbolUrl = resolveAssetUrl(party.symbol, origin);
    const photoUrlResolved = photoUrl ? resolveAssetUrl(String(photoUrl).trim(), origin) : '';

    const { txHash, blockNumber, candidateId: chainId } = await relayAddCandidate(
      electionId,
      name.trim(),
      party.name,
      symbolUrl,
      manifesto,
      photoUrlResolved,
      "",
    );

    let candidateId = chainId;
    if (candidateId === null || candidateId === undefined) {
      candidateId = await Candidate.countDocuments({ electionId });
    }

    const doc = await Candidate.findOneAndUpdate(
      { electionId, candidateId },
      {
        $set: {
          name: name.trim(),
          party: party.name,
          partyId: party._id,
          partyCode: party.code,
          symbol: symbolUrl,
          photoUrl: photoUrlResolved,
          manifesto,
          constituencyCode: filtered ? seatCode : '',
          constituencyName: seat?.name || '',
          state: seat?.state || '',
          district: seat?.district || '',
          city: seat?.city || '',
          village: seat?.village || '',
          txHash,
          blockNumber,
        },
      },
      { upsert: true, returnDocument: 'after' },
    ).lean();

    let ipfsCid = "";
    try {
      ipfsCid = await pinJSON(
        {
          type: "candidate-metadata",
          version: "2.0",
          electionId,
          candidateId,
          name: name.trim(),
          party: party.name,
          partyCode: party.code,
          symbol: symbolUrl,
          constituencyCode: filtered ? seatCode : '',
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

    const total = await Candidate.countDocuments({ electionId });
    await Election.findOneAndUpdate({ electionId }, { $set: { candidateCount: total } });

    const [serialized] = await serializeCandidates([doc], origin);
    return NextResponse.json({
      success: true,
      txHash,
      candidate: serialized,
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

export async function DELETE(req, { params }) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const electionId = id;
    const { searchParams } = new URL(req.url);
    const candidateId = searchParams.get('candidateId');
    const idParam = searchParams.get('id');
    const deleteAll = searchParams.get('all') === 'true';

    await connectDB();
    if (deleteAll) {
      await Candidate.deleteMany({ electionId });
    } else if (candidateId !== null && candidateId !== undefined) {
      await Candidate.deleteOne({ electionId, candidateId: Number(candidateId) });
    } else if (idParam) {
      await Candidate.deleteOne({ _id: idParam, electionId });
    } else {
      return NextResponse.json({ error: "Specify candidateId or all=true" }, { status: 400 });
    }

    const total = await Candidate.countDocuments({ electionId });
    await Election.findOneAndUpdate({ electionId }, { $set: { candidateCount: total } });

    return NextResponse.json({ success: true, remaining: total });
  } catch (err) {
    console.error("[candidates DELETE]", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete candidate" },
      { status: 500 },
    );
  }
}

