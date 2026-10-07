/**
 * POST /api/auth/send-otp   { voterId, electionId }   (email still accepted for legacy rows)
 * Sends the one-time code to the email on the master roll for that voter ID.
 */
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Election from "@/lib/models/Election";
import EmailOTP from "@/lib/models/EmailOTP";
import { sendOTPEmail } from "@/lib/mailer";
import { preflightCheck } from "@/lib/preflightCache";
import { rateLimit } from "@/lib/rateLimit";
import { getVotingWindowStatus } from "@/lib/votingWindow";
import { findVoterAndEnrollment, hasOpenCase, ensureEnrollmentNullifier } from "@/lib/enrollment";
import { maskEmail } from "@/lib/voterIdentity";
import { VOTER_MESSAGES } from "@/lib/voterMessages";
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
    const { voterId, email, electionId } = await req.json();

    if ((!voterId && !email) || electionId === undefined || electionId === null || electionId === "") {
      return NextResponse.json(
        { error: "voterId and electionId are required." },
        { status: 400 },
      );
    }

    await connectDB();
    const eid = String(electionId);

    const election = await Election.findOne({ electionId: eid }).lean();
    if (!election) {
      return NextResponse.json({ error: "Election not found." }, { status: 404 });
    }

    if (election.phase !== 1 || !election.guardianApproved) {
      const msg = election.phase === 2 ? VOTER_MESSAGES.CLOSED : VOTER_MESSAGES.NOT_OPEN;
      return NextResponse.json({ error: msg, code: election.phase === 2 ? "CLOSED" : "NOT_OPEN" }, { status: 403 });
    }

    const votingWindow = getVotingWindowStatus(election);
    if (!votingWindow.open) {
      return NextResponse.json(
        { error: votingWindow.reason, code: votingWindow.code, votingWindow },
        { status: 403 },
      );
    }

    const { voter, enrollment } = await findVoterAndEnrollment({ electionId: eid, voterId, email });
    if (!voter) {
      return NextResponse.json({ error: VOTER_MESSAGES.NOT_ON_LIST, code: "NOT_ON_LIST" }, { status: 404 });
    }
    if (!enrollment) {
      return NextResponse.json({ error: VOTER_MESSAGES.NOT_ENROLLED, code: "NOT_ENROLLED" }, { status: 404 });
    }
    if (await hasOpenCase(voter.voterId)) {
      return NextResponse.json({ error: VOTER_MESSAGES.CASE_OPEN, code: "CASE_OPEN" }, { status: 403 });
    }
    if (enrollment.status === "rejected") {
      return NextResponse.json({ error: VOTER_MESSAGES.REJECTED, code: "REJECTED" }, { status: 403 });
    }

    const nullifierHash = ensureEnrollmentNullifier(enrollment, eid);
    if (enrollment.isModified()) await enrollment.save();

    // Vote-allowance is checked after the OTP in verify-otp, so this endpoint
    // never reveals whether someone has voted to a caller who only knows an ID.
    if (enrollment.status === "registered") {
      const checkResult = await preflightCheck(nullifierHash, eid, { checkAllowance: false });
      if (!checkResult.allowed) {
        return NextResponse.json({ error: checkResult.reason, code: checkResult.code }, { status: 403 });
      }
    }

    const cleanEmail = voter.email;
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
        claimedAt: null,
        resultTxHash: "",
      },
      { upsert: true, returnDocument: "after" },
    );

    await sendOTPEmail(cleanEmail, otp, "vote", election.title || "Block Vote");

    return NextResponse.json({
      success: true,
      message: `We sent a 6-digit code to ${maskEmail(cleanEmail)}.`,
      sentTo: maskEmail(cleanEmail),
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
