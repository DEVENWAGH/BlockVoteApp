/**
 * POST /api/auth/send-otp
 * Voter OTP for mobile app voting (election-scoped, no organization).
 */
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Voter from "@/lib/models/Voter";
import Election from "@/lib/models/Election";
import EmailOTP from "@/lib/models/EmailOTP";
import { sendOTPEmail } from "@/lib/mailer";
import { preflightCheck } from "@/lib/preflightCache";
import { rateLimit } from "@/lib/rateLimit";
import { computeNullifierHash } from "@/lib/voterIdentity";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const otpLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyPrefix: "send-otp",
  message: "Too many OTP requests. Please wait before trying again.",
});

export async function POST(req) {
  const limited = otpLimiter(req);
  if (limited) return limited;

  try {
    const { email, electionId } = await req.json();

    if (!email || electionId === undefined || electionId === null || electionId === "") {
      return NextResponse.json(
        { error: "email and electionId are required." },
        { status: 400 },
      );
    }

    await connectDB();
    const eid = String(electionId);
    const cleanEmail = email.toLowerCase().trim();

    const election = await Election.findOne({ electionId: eid }).lean();
    if (!election) {
      return NextResponse.json({ error: "Election not found." }, { status: 404 });
    }

    const voter = await Voter.findOne({ electionId: eid, email: cleanEmail });
    if (!voter) {
      return NextResponse.json(
        {
          error:
            "Email is not registered for this election. Please check with your election admin.",
        },
        { status: 404 },
      );
    }

    if (voter.status === "rejected") {
      return NextResponse.json(
        {
          error: `Voter registration was rejected: ${voter.rejectionReason || "unknown reason"}.`,
        },
        { status: 403 },
      );
    }

    let nullifierHash = voter.nullifierHash;
    if (!nullifierHash) {
      nullifierHash = computeNullifierHash(cleanEmail);
    }

    if (voter.status === "registered") {
      const checkResult = await preflightCheck(nullifierHash, eid);
      if (!checkResult.allowed) {
        return NextResponse.json({ error: checkResult.reason }, { status: 403 });
      }
    }

    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = await bcrypt.hash(otp, 8);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await EmailOTP.findOneAndUpdate(
      { email: cleanEmail, purpose: "vote", electionId: eid },
      {
        email: cleanEmail,
        otp: otpHash,
        electionId: eid,
        purpose: "vote",
        expiresAt,
        used: false,
        attempts: 0,
      },
      { upsert: true, returnDocument: "after" },
    );

    await sendOTPEmail(cleanEmail, otp, "vote", election.title || "Block Vote");

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully to your email.",
      expiresAt,
    });
  } catch (err) {
    console.error("[send-otp]", err);
    return NextResponse.json(
      { error: err.message || "Failed to send OTP." },
      { status: 500 },
    );
  }
}
