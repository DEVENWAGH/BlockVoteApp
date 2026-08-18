/**
 * POST /api/voters/upload-csv
 * Upsert voters for an election and register them on-chain.
 */
import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import connectDB from "@/lib/db";
import Voter from "@/lib/models/Voter";
import Election from "@/lib/models/Election";
import { pinJSON, getIPFSUrl } from "@/lib/ipfs";
import { relayRegisterVoter, resetRelayNonce, isVoterRegisteredOnChain } from "@/lib/relay";
import { computeNullifierHash, isAlreadyRegisteredError } from "@/lib/voterIdentity";
import { auth } from "@/auth";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 10_000;
const REQUIRED_COLUMNS = ["name", "email"];

function validateEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
function validatePhone(p) {
  return !p || /^\d{10}$/.test(p.replace(/\s/g, ""));
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const formData = await req.formData();
    const file = formData.get("file");
    const electionIdRaw = formData.get("electionId");

    if (!file) {
      return NextResponse.json({ error: "No file received" }, { status: 400 });
    }
    if (electionIdRaw == null || electionIdRaw === "") {
      return NextResponse.json(
        { error: "electionId is required" },
        { status: 400 },
      );
    }
    const electionId = String(electionIdRaw).trim();

    const election = await Election.findOne({ electionId }).lean();
    if (!election) {
      return NextResponse.json({ error: "Election not found" }, { status: 404 });
    }
    if (
      election.createdBy &&
      String(election.createdBy) !== String(session.user.adminId)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 5MB limit" },
        { status: 413 },
      );
    }

    const csvText = new TextDecoder().decode(bytes);

    let records;
    try {
      records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });
    } catch {
      return NextResponse.json(
        { error: "Invalid CSV format. Ensure proper comma-separated values." },
        { status: 400 },
      );
    }

    if (records.length === 0) {
      return NextResponse.json({ error: "CSV file is empty" }, { status: 400 });
    }
    if (records.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `CSV exceeds ${MAX_ROWS} row limit` },
        { status: 400 },
      );
    }

    const headers = Object.keys(records[0]).map((h) => h.toLowerCase().trim());
    for (const col of REQUIRED_COLUMNS) {
      if (!headers.includes(col)) {
        return NextResponse.json(
          {
            error: `Missing required column: "${col}". Required: ${REQUIRED_COLUMNS.join(", ")}`,
          },
          { status: 400 },
        );
      }
    }

    const validVoters = [];
    const errors = [];
    const seenEmails = new Set();

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2;
      const name = (row.name || "").trim();
      const email = (row.email || "").toLowerCase().trim();
      const phone = (row.phone || "").trim();
      const gender = (row.gender || "").trim();
      const ageRaw = (row.age || "").trim();
      const age = ageRaw ? parseInt(ageRaw, 10) : null;

      const rowErrors = [];
      if (!name || name.length < 2)
        rowErrors.push("name is required (min 2 chars)");
      if (!email) rowErrors.push("email is required");
      else if (!validateEmail(email)) rowErrors.push("invalid email format");
      if (phone && !validatePhone(phone))
        rowErrors.push("phone must be 10 digits");
      if (ageRaw && (isNaN(age) || age < 1 || age > 150))
        rowErrors.push("age must be 1–150");
      if (seenEmails.has(email)) rowErrors.push("duplicate email in file");

      if (rowErrors.length > 0) {
        errors.push({
          row: rowNum,
          email: email || "—",
          reason: rowErrors.join("; "),
        });
        continue;
      }

      seenEmails.add(email);
      validVoters.push({ electionId, name, email, phone, gender, age });
    }

    let upserted = 0;
    let updated = 0;

    if (validVoters.length > 0) {
      const ops = validVoters.map((v) => ({
        updateOne: {
          filter: { electionId, email: v.email },
          update: {
            $set: {
              name: v.name,
              phone: v.phone,
              gender: v.gender,
              age: v.age,
            },
            $setOnInsert: {
              electionId,
              email: v.email,
              status: "pending",
            },
          },
          upsert: true,
        },
      }));

      const result = await Voter.bulkWrite(ops, { ordered: false });
      upserted = result.upsertedCount;
      updated = result.modifiedCount;
    }

    let ipfsCid = "";
    try {
      ipfsCid = await pinJSON(
        {
          type: "voter-roster",
          version: "1.0",
          electionId,
          totalVoters: validVoters.length,
          voterEmails: validVoters.map((v) => v.email),
          uploadedAt: new Date().toISOString(),
        },
        `voter-roster-${electionId.slice(0, 10)}-${Date.now()}`,
        { electionId, type: "voter-roster" },
      );
    } catch (ipfsErr) {
      console.warn("[upload-csv] IPFS pin failed (non-fatal):", ipfsErr.message);
    }

    let registered = 0;
    let linked = 0;
    let regFailed = 0;
    const regErrors = [];

    const pendingVoters = await Voter.find({
      electionId,
      status: "pending",
    });

    if (pendingVoters.length > 0) {
      resetRelayNonce();

      for (const voter of pendingVoters) {
        const label = voter.memberId || voter.email;
        const nullifierHash = computeNullifierHash(voter.email);

        try {
          try {
            if (await isVoterRegisteredOnChain(electionId, nullifierHash)) {
              await Voter.findByIdAndUpdate(voter._id, {
                status: "registered",
                nullifierHash,
                registeredAt: new Date(),
                onChainTxHash: "linked-existing",
                rejectionReason: "",
              });
              linked++;
              continue;
            }
          } catch (checkErr) {
            console.warn(`[upload-csv] on-chain check failed for ${label}:`, checkErr.message);
          }

          const { txHash } = await relayRegisterVoter(electionId, nullifierHash);
          await Voter.findByIdAndUpdate(voter._id, {
            status: "registered",
            nullifierHash,
            registeredAt: new Date(),
            onChainTxHash: txHash,
            rejectionReason: "",
          });
          registered++;
        } catch (regErr) {
          if (isAlreadyRegisteredError(regErr)) {
            await Voter.findByIdAndUpdate(voter._id, {
              status: "registered",
              nullifierHash,
              registeredAt: new Date(),
              onChainTxHash: "linked-existing",
              rejectionReason: "",
            });
            linked++;
          } else {
            console.error(`[upload-csv] auto-register failed for ${label}:`, regErr.message);
            await Voter.findByIdAndUpdate(voter._id, {
              status: "rejected",
              nullifierHash,
              rejectionReason: regErr.message,
            });
            regErrors.push(label);
            regFailed++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      electionId,
      total: records.length,
      upserted,
      updated,
      skipped: records.length - validVoters.length - errors.length,
      errors: errors.slice(0, 50),
      hasMoreErrors: errors.length > 50,
      ipfsCid,
      ipfsUrl: getIPFSUrl(ipfsCid),
      registration: {
        registered,
        linked,
        failed: regFailed,
        failedVoters: regErrors,
        invitesSent: 0,
      },
    });
  } catch (err) {
    console.error("[upload-csv] FATAL:", err);
    return NextResponse.json(
      { error: `CSV processing failed: ${err.message || err}` },
      { status: 500 },
    );
  }
}
