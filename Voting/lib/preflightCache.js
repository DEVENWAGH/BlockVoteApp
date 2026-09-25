/**
 * lib/preflightCache.js
 * Edge Pre-flight Validation Cache
 * 
 * Simulates edge-computing behavior (Lambda@Edge + DynamoDB Global Tables)
 * using MongoDB as the fast lookup cache. In production, this would be
 * deployed to CloudFront Lambda@Edge with DynamoDB for sub-10ms latency.
 * 
 * Purpose: Reject invalid/duplicate votes BEFORE they hit the blockchain,
 * saving gas fees and reducing network congestion.
 */
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';
import Election from '@/lib/models/Election';
import { getVotingWindowStatus } from '@/lib/votingWindow';
import { checkVoteAllowance, VOTE_CHANNEL } from '@/lib/voteAllowance';

/**
 * Pre-flight validation for a vote attempt.
 * Returns { allowed, reason, code, latencyMs, isRevote?, votingWindow? }
 * 
 * Checks performed (all from MongoDB cache — no blockchain query):
 * 1. Is the voter registered on-chain for this specific election?
 * 2. Is the election in the Voting phase?
 * 3. Is it within the daily polling hours and the election's dates?
 * 4. Does the voter have a ballot left? (app: 2 casts; station: final override)
 *    Skipped when checkAllowance=false so vote status is not revealed before OTP.
 *
 * electionId is a string (bytes32 hex from the smart contract)
 */
export async function preflightCheck(
  nullifierHash,
  electionId,
  { channel = VOTE_CHANNEL.APP, checkAllowance = true } = {},
) {
  const start = Date.now();

  await connectDB();

  const voter = await Voter.findOne(
    { nullifierHash, electionId: String(electionId), status: 'registered' },
    { _id: 1, votesCast: 1, stationVoteFinal: 1 }
  ).lean();

  if (!voter) {
    return {
      allowed: false,
      reason: 'Voter not registered. Registration is required before voting.',
      code: 'NOT_REGISTERED',
      latencyMs: Date.now() - start,
      cached: true,
    };
  }

  const election = await Election.findOne(
    { electionId: String(electionId) },
    { phase: 1, startTime: 1, endTime: 1 }
  ).lean();

  if (!election) {
    return {
      allowed: false,
      reason: 'Election not found.',
      code: 'ELECTION_NOT_FOUND',
      latencyMs: Date.now() - start,
      cached: true,
    };
  }

  if (election.phase !== 1) {
    const phaseNames = ['Registration', 'Voting', 'Completed'];
    return {
      allowed: false,
      reason: `Election is in "${phaseNames[election.phase]}" phase, not "Voting".`,
      code: 'WRONG_PHASE',
      latencyMs: Date.now() - start,
      cached: true,
    };
  }

  const votingWindow = getVotingWindowStatus(election);
  if (!votingWindow.open) {
    return {
      allowed: false,
      reason: votingWindow.reason,
      code: votingWindow.code,
      votingWindow,
      latencyMs: Date.now() - start,
      cached: true,
    };
  }

  if (!checkAllowance) {
    return {
      allowed: true,
      reason: 'Pre-flight validation passed.',
      code: 'ALLOWED',
      votingWindow,
      latencyMs: Date.now() - start,
      cached: true,
    };
  }

  const allowance = checkVoteAllowance(voter, channel);
  return {
    ...allowance,
    votingWindow,
    latencyMs: Date.now() - start,
    cached: true,
  };
}
