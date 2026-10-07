/**
 * lib/enrollment.js
 * Put people from the master roll into an election, by place — and register
 * them on-chain in batches.
 */
import Voter from './models/Voter.js';
import Enrollment from './models/Enrollment.js';
import VoterCase from './models/VoterCase.js';
import Constituency from './models/Constituency.js';
import { computeNullifierHash, isAlreadyRegisteredError, normalizeVoterId, normalizeEmail } from './voterIdentity.js';
import { resolveSeatForVoter, listSeatsForLevel, normalizeCode } from './seats.js';
import { relayRegisterVoter, isVoterRegisteredOnChain } from './relay.js';

const BULK_CHUNK = 2000;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function placeMatch(value) {
  return { $regex: `^${escapeRegex(String(value).trim())}$`, $options: 'i' };
}

/**
 * Build a Mongo filter on the master roll from an enrollment scope:
 *   { state, district, city, village, ward, constituencyCode, voterIds }
 * Empty values are ignored. Place names match case-insensitively.
 */
export function buildScopeFilter(scope = {}) {
  const filter = {};
  if (scope.state) filter.state = placeMatch(scope.state);
  if (scope.district) filter.district = placeMatch(scope.district);
  if (scope.city) filter.city = placeMatch(scope.city);
  if (scope.village) filter.village = placeMatch(scope.village);
  if (scope.ward) filter.ward = placeMatch(scope.ward);
  if (scope.constituencyCode) {
    const code = normalizeCode(scope.constituencyCode);
    filter.$or = [{ assemblyConstituency: code }, { parliamentaryConstituency: code }];
  }
  if (Array.isArray(scope.voterIds) && scope.voterIds.length) {
    filter.voterId = { $in: scope.voterIds.map(normalizeVoterId).filter(Boolean) };
  }
  return filter;
}

export function describeScope(scope = {}) {
  const parts = [];
  if (scope.constituencyCode) parts.push(`seat ${normalizeCode(scope.constituencyCode)}`);
  if (scope.ward) parts.push(`ward ${scope.ward}`);
  if (scope.village) parts.push(scope.village);
  if (scope.city) parts.push(scope.city);
  if (scope.district) parts.push(scope.district);
  if (scope.state) parts.push(scope.state);
  if (Array.isArray(scope.voterIds) && scope.voterIds.length) parts.push(`${scope.voterIds.length} voter IDs`);
  return parts.length ? parts.join(', ') : 'everyone on the roll';
}

/** Voter IDs that currently have an open guardian case. */
export async function openCaseVoterIds(voterIds) {
  if (!voterIds?.length) return new Set();
  const cases = await VoterCase.find(
    {
      status: 'open',
      $or: [{ 'newRow.voterId': { $in: voterIds } }, { existingVoterId: { $in: voterIds } }],
    },
    { 'newRow.voterId': 1, existingVoterId: 1 },
  ).lean();
  const set = new Set();
  for (const c of cases) {
    if (c.newRow?.voterId) set.add(c.newRow.voterId);
    if (c.existingVoterId) set.add(c.existingVoterId);
  }
  return set;
}

export async function hasOpenCase(voterId) {
  const id = normalizeVoterId(voterId);
  if (!id) return false;
  const count = await VoterCase.countDocuments({
    status: 'open',
    $or: [{ 'newRow.voterId': id }, { existingVoterId: id }],
  });
  return count > 0;
}

/**
 * Enroll everyone on the roll matching `scope` into `election`.
 * Idempotent: already-enrolled people are left untouched.
 * People with an open guardian case are skipped (reported in `skippedCases`).
 */
export async function enrollVotersByScope({ election, scope = {}, adminId = null }) {
  const filter = buildScopeFilter(scope);
  const seats = await listSeatsForLevel(election.level);
  const cursor = Voter.find(filter).lean().cursor();

  let matched = 0;
  let enrolled = 0;
  let alreadyEnrolled = 0;
  let skippedCases = 0;
  let noSeat = 0;
  const noSeatSamples = [];
  let batch = [];

  const flush = async () => {
    if (!batch.length) return;
    const ids = batch.map((v) => v.voterId);
    const openCases = await openCaseVoterIds(ids);
    const existing = await Enrollment.find(
      { electionId: election.electionId, voterId: { $in: ids } },
      { voterId: 1 },
    ).lean();
    const existingIds = new Set(existing.map((e) => e.voterId));

    const ops = [];
    for (const voter of batch) {
      if (openCases.has(voter.voterId)) {
        skippedCases += 1;
        continue;
      }
      if (existingIds.has(voter.voterId)) {
        alreadyEnrolled += 1;
        continue;
      }
      const { code } = await resolveSeatForVoter(voter, election, seats);
      if (election.level !== 'general' && !code) {
        noSeat += 1;
        if (noSeatSamples.length < 5) noSeatSamples.push(voter.voterId);
        continue;
      }
      ops.push({
        insertOne: {
          document: {
            electionId: election.electionId,
            voterId: voter.voterId,
            voter: voter._id,
            constituencyCode: code,
            nullifierHash: computeNullifierHash(voter.voterId, election.electionId),
            status: 'pending',
            votesCast: 0,
            stationVoteFinal: false,
          },
        },
      });
    }
    if (ops.length) {
      const res = await Enrollment.bulkWrite(ops, { ordered: false });
      enrolled += res.insertedCount || 0;
    }
    batch = [];
  };

  for await (const voter of cursor) {
    matched += 1;
    batch.push(voter);
    if (batch.length >= BULK_CHUNK) await flush();
  }
  await flush();

  return { matched, enrolled, alreadyEnrolled, skippedCases, noSeat, noSeatSamples, adminId };
}

/**
 * Register pending enrollments on-chain. Processes up to `limit` people per
 * call so a request never runs for minutes; call again for the rest.
 */
export async function registerPendingEnrollments(electionId, { limit = 25 } = {}) {
  const pending = await Enrollment.find({ electionId, status: 'pending' }).limit(limit);
  let registered = 0;
  let linked = 0;
  let failed = 0;
  const failedVoters = [];

  for (const enrollment of pending) {
    if (!enrollment.nullifierHash) {
      enrollment.nullifierHash = computeNullifierHash(enrollment.voterId, electionId);
    }
    try {
      const already = await isVoterRegisteredOnChain(electionId, enrollment.nullifierHash);
      if (already) {
        enrollment.status = 'registered';
        enrollment.registeredAt = new Date();
        await enrollment.save();
        linked += 1;
        continue;
      }
      const { txHash } = await relayRegisterVoter(electionId, enrollment.nullifierHash);
      enrollment.status = 'registered';
      enrollment.registeredAt = new Date();
      enrollment.onChainTxHash = txHash;
      await enrollment.save();
      registered += 1;
    } catch (err) {
      if (isAlreadyRegisteredError(err)) {
        enrollment.status = 'registered';
        enrollment.registeredAt = new Date();
        await enrollment.save();
        linked += 1;
      } else {
        failed += 1;
        if (failedVoters.length < 10) failedVoters.push({ voterId: enrollment.voterId, error: err.message });
      }
    }
  }

  const remaining = await Enrollment.countDocuments({ electionId, status: 'pending' });
  return { processed: pending.length, registered, linked, failed, failedVoters, remaining };
}

/**
 * Find the master-roll person and their enrollment for a vote.
 * Accepts a voter ID; falls back to email for roll entries migrated from
 * the old per-election format.
 */
export async function findVoterAndEnrollment({ electionId, voterId, email }) {
  let voter = null;
  const id = normalizeVoterId(voterId);
  if (id) voter = await Voter.findOne({ voterId: id }).lean();
  if (!voter && email) {
    const cleanEmail = normalizeEmail(email);
    if (cleanEmail) voter = await Voter.findOne({ email: cleanEmail }).lean();
  }
  if (!voter) return { voter: null, enrollment: null };

  let enrollment = await Enrollment.findOne({ electionId: String(electionId), voterId: voter.voterId });
  if (!enrollment) {
    const code = voter.assemblyConstituency || voter.parliamentaryConstituency || '';
    const nullifierHash = computeNullifierHash(voter.voterId, String(electionId));
    try {
      enrollment = await Enrollment.findOneAndUpdate(
        { electionId: String(electionId), voterId: voter.voterId },
        {
          $setOnInsert: {
            electionId: String(electionId),
            voterId: voter.voterId,
            voter: voter._id,
            constituencyCode: code,
            nullifierHash,
            status: 'registered',
            votesCast: 0,
            stationVoteFinal: false,
          },
        },
        { upsert: true, new: true },
      );
    } catch {
      enrollment = await Enrollment.findOne({ electionId: String(electionId), voterId: voter.voterId });
    }
  }
  return { voter, enrollment };
}

/** Make sure an enrollment has a nullifier (legacy rows may not). */
export function ensureEnrollmentNullifier(enrollment, electionId) {
  if (!enrollment.nullifierHash) {
    enrollment.nullifierHash = computeNullifierHash(enrollment.voterId, electionId);
  }
  return enrollment.nullifierHash;
}

/** Seat document (if any) for an enrollment, for the voter slip. */
export async function seatForEnrollment(enrollment) {
  if (!enrollment?.constituencyCode) return null;
  return Constituency.findOne({ code: enrollment.constituencyCode }).lean();
}

/** Counts used by the guardian checklist and the dashboard enrollment panel. */
export async function enrollmentSummary(electionId) {
  const [total, registered, pending, rejected, voted] = await Promise.all([
    Enrollment.countDocuments({ electionId }),
    Enrollment.countDocuments({ electionId, status: 'registered' }),
    Enrollment.countDocuments({ electionId, status: 'pending' }),
    Enrollment.countDocuments({ electionId, status: 'rejected' }),
    Enrollment.countDocuments({ electionId, votesCast: { $gt: 0 } }),
  ]);
  return { total, registered, pending, rejected, voted };
}
