/**
 * POST /api/admin/wipe-data
 * Wipe election-related MongoDB data (keeps organizations).
 * Body: { confirm: true, issuedAt, signature } — signed by a guardian wallet
 */
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { verifyGuardianAction } from "@/lib/guardianAuth";

const COLLECTIONS = [
  "voters",
  "elections",
  "voteactivities",
  "candidates",
  "relaytransactions",
  "voterregistrations",
  "emailotps",
  "biometrichashes",
];

export async function POST(req) {
  try {
    const { confirm, issuedAt, signature } = await req.json();

    if (!confirm) {
      return NextResponse.json(
        { error: "Send { confirm: true } to proceed" },
        { status: 400 },
      );
    }

    const guardian = await verifyGuardianAction({ action: "data:wipe", issuedAt, signature });
    if (!guardian.ok) {
      return NextResponse.json({ error: guardian.error }, { status: 403 });
    }

    await connectDB();
    const db = (await import("mongoose")).default.connection.db;

    const deleted = {};
    for (const name of COLLECTIONS) {
      try {
        const result = await db.collection(name).deleteMany({});
        deleted[name] = result.deletedCount;
      } catch {
        deleted[name] = 0;
      }
    }

    const total = Object.values(deleted).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      success: true,
      deleted,
      total,
      message:
        total === 0
          ? "Database was already empty"
          : `Wiped ${total} document(s). Create a new election and re-upload voters.`,
    });
  } catch (err) {
    console.error("[admin/wipe-data]", err);
    return NextResponse.json(
      { error: err.message || "Wipe failed" },
      { status: 500 },
    );
  }
}
