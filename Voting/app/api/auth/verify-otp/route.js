/**
 * POST /api/auth/verify-otp
 * Verify email OTP + biometric token, then relay castVote.
 * Android app votes use the "app" allowance (first vote + one change);
 * requests from an activated polling-station computer cast a final "station" vote.
 */
import { NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Voter from "@/lib/models/Voter";
import EmailOTP from "@/lib/models/EmailOTP";
import { preflightCheck } from "@/lib/preflightCache";
import { relayCastVote, relayRegisterVoter, isVoterRegisteredOnChain } from "@/lib/relay";
import { sendVoteReceiptEmail } from "@/lib/mailer";
import bcrypt from "bcryptjs";
import { verifyBiometricToken } from "@/lib/biometric";
import { computeNullifierHash } from "@/lib/voterIdentity";
import { applyCoarseLocationToVoter } from "@/lib/coarseLocation";
import { getStationSession } from "@/lib/stationSession";
import { VOTE_CHANNEL, appVotesRemainingAfter } from "@/lib/voteAllowance";
import { reserveVoteSlot, releaseVoteSlot } from "@/lib/voteLedger";
import { getPublicBaseUrl } from "@/lib/serverEnv";

export async function POST(req) {
  try {
    const { email, otp, electionId, candidateId, biometricToken: bodyToken, location } = await req.json();
    const biometricToken = req.headers.get("x-biometric-token") || bodyToken;

    if (
      !email ||
      !otp ||
      electionId === undefined ||
      electionId === null ||
      electionId === "" ||
      candidateId === undefined
    ) {
      return NextResponse.json(
        { error: "email, otp, electionId, and candidateId are required." },
        { status: 400 },
      );
    }

    await connectDB();

    const cleanEmail = email.toLowerCase().trim();
    const eid = String(electionId);

    const record = await EmailOTP.findOne({
      email: cleanEmail,
      purpose: "vote",
      electionId: eid,
    });

    if (!record || record.used) {
      return NextResponse.json(
        {
          error:
            "OTP has expired or has already been used. Please request a new one.",
        },
        { status: 400 },
      );
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json(
        { error: "OTP has expired. Please request a new one." },
        { status: 400 },
      );
    }

    if (record.attempts >= 3) {
      return NextResponse.json(
        { error: "Too many incorrect attempts. Please request a new OTP." },
        { status: 400 },
      );
    }

    const validOTP = await bcrypt.compare(String(otp).trim(), record.otp);
    if (!validOTP) {
      record.attempts += 1;
      await record.save();
      const remaining = 3 - record.attempts;
      return NextResponse.json(
        {
          error: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
        },
        { status: 400 },
      );
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

    let nullifierHash = voter.nullifierHash;

    if (voter.status === "pending" || !nullifierHash) {
      nullifierHash = computeNullifierHash(cleanEmail);

      try {
        const alreadyOnChain = await isVoterRegisteredOnChain(eid, nullifierHash);
        if (alreadyOnChain) {
          await Voter.findByIdAndUpdate(voter._id, {
            status: "registered",
            nullifierHash,
            registeredAt: new Date(),
            onChainTxHash: "auto-linked",
            rejectionReason: "",
          });
          voter.status = "registered";
          voter.nullifierHash = nullifierHash;
        } else {
          const { txHash } = await relayRegisterVoter(eid, nullifierHash);
          await Voter.findByIdAndUpdate(voter._id, {
            status: "registered",
            nullifierHash,
            registeredAt: new Date(),
            onChainTxHash: txHash,
            rejectionReason: "",
          });
          voter.status = "registered";
          voter.nullifierHash = nullifierHash;
        }
      } catch (regErr) {
        console.error(`[verify-otp] Auto-registration failed for ${cleanEmail}:`, regErr.message);
        return NextResponse.json(
          {
            error:
              "Your voter registration could not be finalized on the blockchain. Please contact your election admin.",
          },
          { status: 403 },
        );
      }
    }

    if (voter.status !== "registered") {
      return NextResponse.json(
        {
          error: `Voter registration status is "${voter.status}". Please contact your admin.`,
        },
        { status: 403 },
      );
    }

    if (!voter.nullifierHash) {
      return NextResponse.json(
        {
          error:
            "Voter on-chain registration is incomplete. Please contact your admin.",
        },
        { status: 403 },
      );
    }

    nullifierHash = voter.nullifierHash;

    if (!biometricToken) {
      return NextResponse.json(
        {
          error:
            "Biometric session verification required. Please verify your face first.",
        },
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
        {
          error:
            "Biometric authentication is invalid or expired. Please verify your face again.",
        },
        { status: 403 },
      );
    }

    const station = await getStationSession();
    const channel =
      station && station.electionId === eid ? VOTE_CHANNEL.STATION : VOTE_CHANNEL.APP;

    const checkResult = await preflightCheck(nullifierHash, eid, { channel });
    if (!checkResult.allowed) {
      return NextResponse.json(
        { error: checkResult.reason, code: checkResult.code },
        { status: 403 },
      );
    }

    if (channel === VOTE_CHANNEL.APP) {
      try {
        await applyCoarseLocationToVoter(voter._id, location);
      } catch (locationErr) {
        console.warn('[verify-otp] coarse location update skipped:', locationErr.message);
      }
    }

    const before = await reserveVoteSlot(voter._id, channel);
    if (!before) {
      const recheck = await preflightCheck(nullifierHash, eid, { channel });
      return NextResponse.json(
        {
          error: recheck.allowed ? "Another vote is already being processed. Please wait." : recheck.reason,
          code: recheck.code,
        },
        { status: 409 },
      );
    }

    let txHash;
    let isRevote;
    try {
      ({ txHash, isRevote } = await relayCastVote(eid, Number(candidateId), nullifierHash, { channel }));
    } catch (relayErr) {
      await releaseVoteSlot(voter._id, before);
      throw relayErr;
    }

    const votesCast = (Number(before.votesCast) || 0) + 1;
    const votesRemaining = appVotesRemainingAfter(votesCast, channel);

    const Election = (await import("@/lib/models/Election")).default;
    const election = await Election.findOne({ electionId: eid }).lean();

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

    record.used = true;
    await record.save();

    let message = "Vote successfully relayed and recorded on the blockchain.";
    if (channel === VOTE_CHANNEL.STATION) {
      message = isRevote
        ? "Polling-station vote recorded. It replaced your earlier app vote and is now final."
        : "Polling-station vote recorded. It is final.";
    } else if (isRevote) {
      message = "Your vote was changed. This was your last change in the app — only a polling-station vote can replace it now.";
    } else {
      message = "Vote recorded. You can change it once more from the app if you change your mind.";
    }

    return NextResponse.json({
      success: true,
      message,
      txHash,
      verifyUrl,
      channel,
      isRevote: Boolean(isRevote),
      isFinal: channel === VOTE_CHANNEL.STATION || votesRemaining === 0,
      votesRemaining,
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
      userMessage =
        "Your voter registration is not yet finalized on the blockchain. Please contact your election admin.";
    } else if (reason.includes("already voted")) {
      userMessage =
        "Your vote has already been recorded on the blockchain for this election.";
    } else if (
      reason.includes("election not active") ||
      reason.includes("not in voting phase") ||
      reason.includes("not voting phase")
    ) {
      userMessage = "This election is no longer accepting votes.";
    } else if (reason.includes("invalid candidate")) {
      userMessage = "The selected candidate is not valid for this election.";
    }

    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
