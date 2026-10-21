/**
 * POST /api/voters/upload-csv
 * Import the master electoral roll (one row per person, keyed by voter ID).
 *
 * - Rows are NOT tied to an election. Pass `electionId` to also enroll the
 *   imported people into that election (same as the "Include voters" button).
 * - Rows with missing required fields or an unknown seat code become a
 *   "missing" guardian case. Rows that clash with someone already on the roll
 *   become a "duplicate" case. Identical rows are skipped silently.
 * - Up to 50,000 rows per file, written in chunks.
 */
import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import connectDB from "@/lib/db";
import Voter from "@/lib/models/Voter";
import VoterCase from "@/lib/models/VoterCase";
import Constituency from "@/lib/models/Constituency";
import Election from "@/lib/models/Election";
import { pinJSON, getIPFSUrl } from "@/lib/ipfs";
import { auth } from "@/auth";
import {
  mapHeaders,
  rowFromRecord,
  classifyRow,
  ROLL_COLUMNS,
} from "@/lib/rollValidation";
import { enrollVotersByScope, registerPendingEnrollments } from "@/lib/enrollment";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_ROWS = 50_000;
const CHUNK = 2000;
const REQUIRED_HEADERS = ["voterId", "name", "email"];
const FIRST_BATCH_ON_CHAIN = 25;

function chunked(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function snapshot(voter) {
  if (!voter) return null;
  const { _id, __v, createdBy, ...rest } = voter;
  return rest;
}

import mongoose from 'mongoose';
import { getAdminOrGuardian } from '@/lib/adminSession';

export async function POST(req) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) {
      return NextResponse.json({ error: "Unauthorized — Guardian or Admin access required" }, { status: 401 });
    }

    const validAdminObjectId = (authResult.adminId && mongoose.Types.ObjectId.isValid(authResult.adminId))
      ? authResult.adminId
      : null;

    await connectDB();

    const formData = await req.formData();
    const file = formData.get("file");
    const electionIdRaw = formData.get("electionId");
    const electionId = electionIdRaw ? String(electionIdRaw).trim() : "";

    if (!file) {
      return NextResponse.json({ error: "No file received" }, { status: 400 });
    }

    let election = null;
    if (electionId) {
      election = await Election.findOne({ electionId }).lean();
      if (!election) {
        return NextResponse.json({ error: "Election not found" }, { status: 404 });
      }
      if (election.createdBy && !authResult.isGuardian && String(election.createdBy) !== String(authResult.adminId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 20MB limit" }, { status: 413 });
    }

    const csvText = new TextDecoder().decode(bytes);

    let records;
    try {
      records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
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
        { error: `CSV exceeds ${MAX_ROWS.toLocaleString()} row limit. Split the file and upload again.` },
        { status: 400 },
      );
    }

    const { mapping, unknown } = mapHeaders(Object.keys(records[0]));
    const present = new Set(Object.values(mapping));
    const missingHeaders = REQUIRED_HEADERS.filter((c) => !present.has(c));
    if (missingHeaders.length) {
      return NextResponse.json(
        {
          error: `Missing required column${missingHeaders.length > 1 ? "s" : ""}: ${missingHeaders.join(", ")}. Expected columns: ${ROLL_COLUMNS.join(", ")}.`,
        },
        { status: 400 },
      );
    }

    // Known seat codes (all levels) — a seat on the row must exist.
    const seatDocs = await Constituency.find({}, { code: 1 }).lean();
    const seatCodes = new Set(seatDocs.map((s) => s.code));

    // Normalize every row first so we can pre-load existing people in bulk.
    const rows = records.map((record, i) => ({ rowNumber: i + 2, row: rowFromRecord(record, mapping) }));

    const fileVoterIds = [...new Set(rows.map((r) => r.row.voterId).filter(Boolean))];
    const fileEmails = [...new Set(rows.map((r) => r.row.email).filter(Boolean))];
    const filePhones = [...new Set(rows.map((r) => r.row.phone).filter(Boolean))];

    const byVoterId = new Map();
    const byEmail = new Map();
    const byPhone = new Map();

    const addExisting = (voter) => {
      byVoterId.set(voter.voterId, voter);
      if (voter.email && !byEmail.has(voter.email)) byEmail.set(voter.email, voter);
      if (voter.phone) {
        const list = byPhone.get(voter.phone) || [];
        if (!list.some((v) => v.voterId === voter.voterId)) list.push(voter);
        byPhone.set(voter.phone, list);
      }
    };

    for (const ids of chunked(fileVoterIds, CHUNK)) {
      (await Voter.find({ voterId: { $in: ids } }).lean()).forEach(addExisting);
    }
    for (const emails of chunked(fileEmails, CHUNK)) {
      (await Voter.find({ email: { $in: emails } }).lean()).forEach(addExisting);
    }
    for (const phones of chunked(filePhones, CHUNK)) {
      (await Voter.find({ phone: { $in: phones } }).lean()).forEach(addExisting);
    }

    const seenInFile = new Set();
    const toInsert = [];
    const cases = [];
    const unchangedIds = [];
    let skipped = 0;

    const sourceFile = String(file.name || "roll.csv").slice(0, 120);

    for (const { rowNumber, row } of rows) {
      const result = classifyRow(row, { byVoterId, byEmail, byPhone, seenInFile, seatCodes });

      if (result.action === "add") {
        seenInFile.add(row.voterId);
        toInsert.push(row);
        continue;
      }
      if (result.action === "skip") {
        seenInFile.add(row.voterId);
        unchangedIds.push(row.voterId);
        skipped += 1;
        continue;
      }
      if (row.voterId) seenInFile.add(row.voterId);
      cases.push({
        kind: result.action,
        reasons: result.reasons,
        matchedOn: result.matchedOn,
        newRow: row,
        existingVoterId: result.existing?.voterId || "",
        existingSnapshot: snapshot(result.existing),
        sourceFile,
        rowNumber,
        createdBy: validAdminObjectId,
      });
    }

    // Insert new people in chunks.
    let added = 0;
    const now = new Date();
    for (const batch of chunked(toInsert, CHUNK)) {
      const ops = batch.map((v) => ({
        updateOne: {
          filter: { voterId: v.voterId },
          update: {
            $setOnInsert: {
              ...v,
              source: "csv",
              createdBy: validAdminObjectId,
            },
            $set: { lastImportedAt: now },
          },
          upsert: true,
        },
      }));
      const res = await Voter.bulkWrite(ops, { ordered: false });
      added += res.upsertedCount || 0;
    }

    // Open guardian cases. A re-upload of the same row replaces its open case
    // instead of piling up a second one.
    let casesOpened = 0;
    if (cases.length) {
      const caseVoterIds = [...new Set(cases.map((c) => c.newRow.voterId).filter(Boolean))];
      if (caseVoterIds.length) {
        for (const ids of chunked(caseVoterIds, CHUNK)) {
          await VoterCase.deleteMany({ status: "open", "newRow.voterId": { $in: ids }, sourceFile });
        }
      }
      for (const batch of chunked(cases, CHUNK)) {
        const inserted = await VoterCase.insertMany(batch, { ordered: false });
        casesOpened += inserted.length;
      }
    }

    let ipfsCid = "";
    try {
      ipfsCid = await pinJSON(
        {
          type: "master-roll-import",
          version: "2.0",
          rows: records.length,
          added,
          unchanged: skipped,
          casesOpened,
          voterIds: toInsert.map((v) => v.voterId),
          uploadedAt: now.toISOString(),
        },
        `master-roll-${Date.now()}`,
        { type: "master-roll-import" },
      );
    } catch (ipfsErr) {
      console.warn("[upload-csv] IPFS pin failed (non-fatal):", ipfsErr.message);
    }

    // Optional: enroll the imported people into an election right away.
    let enrollment = null;
    if (election) {
      const voterIds = [...toInsert.map((v) => v.voterId), ...unchangedIds];
      if (voterIds.length) {
        const summary = await enrollVotersByScope({
          election,
          scope: { voterIds },
          adminId: authResult.adminId,
        });
        await Election.updateOne(
          { electionId },
          {
            $push: {
              enrollmentRules: {
                label: `CSV import: ${sourceFile}`,
                scope: { source: sourceFile },
                matched: summary.matched,
                enrolled: summary.enrolled,
                skippedCases: summary.skippedCases,
                at: new Date(),
              },
            },
          },
        );
        const registration = await registerPendingEnrollments(electionId, { limit: FIRST_BATCH_ON_CHAIN });
        enrollment = { ...summary, registration };
      }
    }

    return NextResponse.json({
      success: true,
      total: records.length,
      added,
      unchanged: skipped,
      casesOpened,
      caseBreakdown: {
        missing: cases.filter((c) => c.kind === "missing").length,
        duplicate: cases.filter((c) => c.kind === "duplicate").length,
      },
      caseSamples: cases.slice(0, 20).map((c) => ({
        row: c.rowNumber,
        kind: c.kind,
        voterId: c.newRow.voterId || "—",
        reason: c.reasons.join(" "),
      })),
      ignoredColumns: unknown,
      ipfsCid,
      ipfsUrl: ipfsCid ? getIPFSUrl(ipfsCid) : "",
      enrollment,
      electionId: electionId || null,
    });
  } catch (err) {
    console.error("[upload-csv] FATAL:", err);
    return NextResponse.json(
      { error: `CSV processing failed: ${err.message || err}` },
      { status: 500 },
    );
  }
}
