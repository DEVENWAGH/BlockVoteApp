/**
 * POST /api/auth/verify-otp
 * Verify email OTP + biometric token, then relay castVote.
 *
 * Body: { voterId, otp, electionId, candidateId, biometricToken?, location? }
 * (`email` still accepted for rows migrated from the old per-election roster)
 *
 * - The candidate must be on the voter's HOME ballot (same constituency).
 *   The booth the voter is standing at never changes which ballot they get.
 * - Android app votes use the "app" allowance (first vote + one change);
 *   requests from an activated polling-station computer cast a final "station" vote.
 * - The booth is recorded on the enrollment as where the vote was cast.
 */
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import EmailOTP from "@/lib/models/EmailOTP";
import Election from "@/lib/models/Election";
import Candidate from "@/lib/models/Candidate";
import { preflightCheck } from "@/lib/preflightCache";
import { relayCastVote, relayRegisterVoter, isVoterRegisteredOnChain } from "@/lib/relay";
import { sendVoteReceiptEmail } from "@/lib/mailer";
import bcrypt from "bcryptjs";
import { verifyBiometricToken } from "@/lib/biometric";
import { toCapturedLocality } from "@/lib/coarseLocation";
import { getStationSession } from "@/lib/stationSession";
import { VOTE_CHANNEL, appVotesRemainingAfter } from "@/lib/voteAllowance";
import {
  reserveVoteSlot,
  releaseVoteSlot,
  acquireCastLock,
  releaseCastLock,
  recordCastPlace,
} from "@/lib/voteLedger";
import { getPublicBaseUrl } from "@/lib/serverEnv";
import { findVoterAndEnrollment, hasOpenCase, ensureEnrollmentNullifier } from "@/lib/enrollment";
import { usesSeatFiltering } from "@/lib/seats";
import { VOTER_MESSAGES } from "@/lib/voterMessages";

function alreadyRecorded(record, fallbackChannel) {
  return NextResponse.json({
    success: true,
    alreadyRecorded: true,
    message: record.resultMessage || "Your vote was already recorded. It was not submitted again.",
    txHash: record.resultTxHash,
    receiptCode: record.resultTxHash,
    verifyUrl: record.resultVerifyUrl || "",
    channel: record.resultChannel || fallbackChannel,
    isRevote: Boolean(record.resultIsRevote),
    isFinal: record.resultChannel === VOTE_CHANNEL.STATION || record.resultVotesRemaining === 0,
    votesRemaining: record.resultVotesRemaining,
  });
}

export async function POST(req) {
  try {
    const {
      voterId,
      email,
      otp,
      electionId,
      candidateId,
      biometricToken: bodyToken,
      location,
    } = await req.json();
    const biometricToken = req.headers.get("x-biometric-token") || bodyToken;

    if (
      (!voterId && !email) ||
      !otp ||
      electionId === undefined ||
      electionId === null ||
      electionId === "" ||
      candidateId === undefined ||
      candidateId === null
    ) {
      return NextResponse.json(
        { error: "voterId, otp, electionId, and candidateId are required." },
        { status: 400 },
      );
    }

    await connectDB();
    const eid = String(electionId);

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

    const cleanEmail = voter.email;

    const record = await EmailOTP.findOne({ email: cleanEmail, purpose: "vote", electionId: eid });
    if (!record) {
      return NextResponse.json(
        { error: "The code has expired or was already used. Please ask for a new code." },
        { status: 400 },
      );
    }

    if (record.used && record.resultTxHash) return alreadyRecorded(record, VOTE_CHANNEL.APP);

    if (record.used) {
      return NextResponse.json(
        { error: "The code has expired or was already used. Please ask for a new code." },
        { status: 400 },
      );
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json({ error: "The code has expired. Please ask for a new code." }, { status: 400 });
    }

    if (record.attempts >= 3) {
      return NextResponse.json(
        { error: "Too many wrong codes. Please ask for a new code." },
        { status: 400 },
      );
    }

    const validOTP = await bcrypt.compare(String(otp).trim(), record.otp);
    if (!validOTP) {
      record.attempts += 1;
      await record.save();
      const remaining = 3 - record.attempts;
      return NextResponse.json(
        { error: `That code is not right. ${remaining} attempt${remaining !== 1 ? "s" : ""} left.` },
        { status: 400 },
      );
    }

    // ── Register on-chain if this person was enrolled but not yet registered ──
    let nullifierHash = ensureEnrollmentNullifier(enrollment, eid);

    if (enrollment.status === "pending") {
      try {
        const alreadyOnChain = await isVoterRegisteredOnChain(eid, nullifierHash);
        if (alreadyOnChain) {
          enrollment.onChainTxHash = enrollment.onChainTxHash || "auto-linked";
        } else {
          const { txHash } = await relayRegisterVoter(eid, nullifierHash);
          enrollment.onChainTxHash = txHash;
        }
        enrollment.status = "registered";
        enrollment.registeredAt = new Date();
        enrollment.rejectionReason = "";
        await enrollment.save();
      } catch (regErr) {
        console.error(`[verify-otp] Auto-registration failed for ${voter.voterId}:`, regErr.message);
        return NextResponse.json(
          { error: "Your registration could not be completed right now. Please ask the booth officer." },
          { status: 403 },
        );
      }
    } else if (enrollment.isModified()) {
      await enrollment.save();
    }

    if (enrollment.status !== "registered") {
      return NextResponse.json({ error: VOTER_MESSAGES.REJECTED, code: "REJECTED" }, { status: 403 });
    }

    // ── Face check must be bound to this voter ──
    if (!biometricToken) {
      return NextResponse.json(
        { error: "Please complete the face check first." },
        { status: 403 },
      );
    }

    const decodedBiometric = verifyBiometricToken(biometricToken);
    if (
      !decodedBiometric ||
      !decodedBiometric.authenticated ||
      decodedBiometric.nullifierHash !== nullifierHash
    ) {
      return NextResponse.json(
        { error: "The face check has expired. Please do the face check again." },
        { status: 403 },
      );
    }

    const station = await getStationSession();
    const channel =
      station && station.electionId === eid ? VOTE_CHANNEL.STATION : VOTE_CHANNEL.APP;

    // ── The candidate must be on this voter's home ballot ──
    const election = await Election.findOne({ electionId: eid }).lean();
    if (!election) {
      return NextResponse.json({ error: "Election not found." }, { status: 404 });
    }
    const cid = Number(candidateId);
    if (!Number.isInteger(cid) || cid < 0) {
      return NextResponse.json({ error: VOTER_MESSAGES.WRONG_SEAT, code: "WRONG_SEAT" }, { status: 400 });
    }
    const candidate = await Candidate.findOne({ electionId: eid, candidateId: cid }).lean();
    if (usesSeatFiltering(election)) {
      if (!candidate || (candidate.constituencyCode || "") !== (enrollment.constituencyCode || "")) {
        return NextResponse.json({ error: VOTER_MESSAGES.WRONG_SEAT, code: "WRONG_SEAT" }, { status: 403 });
      }
    }

    const checkResult = await preflightCheck(nullifierHash, eid, { channel });
    if (!checkResult.allowed) {
      return NextResponse.json(
        { error: checkResult.reason, code: checkResult.code },
        { status: 403 },
      );
    }

    const claimed = await EmailOTP.findOneAndUpdate(
      {
        _id: record._id,
        used: { $ne: true },
        $or: [
          { claimedAt: null },
          { claimedAt: { $exists: false } },
          { claimedAt: { $lte: new Date(Date.now() - 2 * 60 * 1000) } },
        ],
      },
      { $set: { claimedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!claimed) {
      const latest = await EmailOTP.findById(record._id).lean();
      if (latest?.resultTxHash) return alreadyRecorded(latest, channel);
      return NextResponse.json(
        { error: "Your vote is already being recorded. Please wait for the confirmation." },
        { status: 409 },
      );
    }

    const unclaim = () =>
      EmailOTP.updateOne({ _id: record._id, used: { $ne: true } }, { $set: { claimedAt: null } });

    const locked = await acquireCastLock(enrollment._id);
    if (!locked) {
      await unclaim();
      return NextResponse.json(
        { error: "Your vote is already being recorded. Please wait for the confirmation." },
        { status: 409 },
      );
    }

    let before;
    try {
      before = await reserveVoteSlot(enrollment._id, channel);
      if (!before) {
        const recheck = await preflightCheck(nullifierHash, eid, { channel });
        await releaseCastLock(enrollment._id);
        await unclaim();
        return NextResponse.json(
          {
            error: recheck.allowed ? "Another vote is already being processed. Please wait." : recheck.reason,
            code: recheck.code,
          },
          { status: 409 },
        );
      }
    } catch (reserveErr) {
      await releaseCastLock(enrollment._id);
      await unclaim();
      throw reserveErr;
    }

    let txHash;
    let isRevote;
    try {
      ({ txHash, isRevote } = await relayCastVote(eid, cid, nullifierHash, { channel }));
    } catch (relayErr) {
      await releaseVoteSlot(enrollment._id, before);
      await releaseCastLock(enrollment._id);
      await unclaim();
      throw relayErr;
    }

    await releaseCastLock(enrollment._id);

    // Where the vote was cast — analytics only, never the home seat.
    try {
      await recordCastPlace(enrollment._id, {
        channel,
        booth: station,
        locality: toCapturedLocality(location),
      });
    } catch (placeErr) {
      console.warn("[verify-otp] cast place not recorded:", placeErr.message);
    }

    const votesCast = (Number(before.votesCast) || 0) + 1;
    const votesRemaining = appVotesRemainingAfter(votesCast, channel);

    const verifyUrl = `${getPublicBaseUrl()}/verify?txHash=${encodeURIComponent(txHash)}`;

    try {
      await sendVoteReceiptEmail(cleanEmail, {
        electionTitle: election?.title || `Election #${eid.slice(0, 10)}`,
        txHash,
        verifyUrl,
      });
    } catch (mailErr) {
      console.error("[verify-otp] receipt email failed:", mailErr);
    }

    let message;
    if (channel === VOTE_CHANNEL.STATION) {
      message = isRevote
        ? "Your vote is recorded. It replaced your earlier vote from the app and is now final."
        : "Your vote is recorded. It is final.";
    } else if (isRevote) {
      message = "Your vote was changed. This was your last change in the app — only a vote at a polling station can replace it now.";
    } else {
      message = "Your vote is recorded. You can change it once from the app if you change your mind.";
    }

    record.used = true;
    record.resultTxHash = txHash;
    record.resultVerifyUrl = verifyUrl;
    record.resultMessage = message;
    record.resultChannel = channel;
    record.resultIsRevote = Boolean(isRevote);
    record.resultVotesRemaining = votesRemaining;
    await record.save();

    return NextResponse.json({
      success: true,
      message,
      txHash,
      receiptCode: txHash,
      verifyUrl,
      channel,
      isRevote: Boolean(isRevote),
      isFinal: channel === VOTE_CHANNEL.STATION || votesRemaining === 0,
      votesRemaining,
      candidateName: candidate?.name || "",
      party: candidate?.party || "",
    });
  } catch (err) {
    console.error("[verify-otp]", err);

    const reason = err?.reason || err?.revert?.args?.[0] || err?.message || "Verification failed.";
    let userMessage = reason;

    if (err?.code === "VOTE_LIMIT_REACHED" || reason.includes("vote limit reached")) {
      return NextResponse.json(
        {
          error:
            "You have used both app votes (your first vote and one change). To change it again, vote in person at your polling station.",
          code: "VOTE_LIMIT_REACHED",
        },
        { status: 403 },
      );
    }

    if (reason.includes("voter not registered")) {
      userMessage = "Your registration is not complete yet. Please ask the booth officer.";
    } else if (reason.includes("already voted")) {
      userMessage = "Your vote has already been recorded for this election.";
    } else if (
      reason.includes("election not active") ||
      reason.includes("not in voting phase") ||
      reason.includes("not voting phase")
    ) {
      userMessage = VOTER_MESSAGES.CLOSED;
    } else if (reason.includes("invalid candidate")) {
      userMessage = VOTER_MESSAGES.WRONG_SEAT;
    }

    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
