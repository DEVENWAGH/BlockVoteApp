/**
 * lib/voteLedger.js
 * Atomic vote-slot reservation on the Voter document, so concurrent requests
 * cannot exceed the vote allowance before the relay transaction lands.
 */
import Voter from '@/lib/models/Voter';
import { MAX_APP_VOTES, VOTE_CHANNEL } from '@/lib/voteAllowance';

/**
 * Reserve one ballot for this voter. Returns the voter document as it was
 * BEFORE the reservation (pass it to releaseVoteSlot on failure), or null
 * if the allowance is already used up.
 */
export async function reserveVoteSlot(voterId, channel) {
  const filter = { _id: voterId, stationVoteFinal: { $ne: true } };
  if (channel !== VOTE_CHANNEL.STATION) {
    filter.votesCast = { $not: { $gte: MAX_APP_VOTES } };
  }

  const update = { $inc: { votesCast: 1 } };
  if (channel === VOTE_CHANNEL.STATION) {
    update.$set = { stationVoteFinal: true };
  }

  return Voter.findOneAndUpdate(filter, update, { returnDocument: 'before' }).lean();
}

const CAST_LOCK_MS = 90_000;

/**
 * One in-flight cast per voter. A second tap during chain lag must not
 * consume the "change vote" allowance.
 */
export async function acquireCastLock(voterId) {
  const now = new Date();
  const doc = await Voter.findOneAndUpdate(
    {
      _id: voterId,
      $or: [
        { castLockUntil: null },
        { castLockUntil: { $exists: false } },
        { castLockUntil: { $lte: now } },
      ],
    },
    { $set: { castLockUntil: new Date(now.getTime() + CAST_LOCK_MS) } },
    { returnDocument: 'after' },
  ).lean();
  return Boolean(doc);
}

export async function releaseCastLock(voterId) {
  await Voter.updateOne({ _id: voterId }, { $set: { castLockUntil: null } });
}

/** Undo a reservation after the relay transaction failed. */
export async function releaseVoteSlot(voterId, before) {
  await Voter.updateOne(
    { _id: voterId },
    {
      $inc: { votesCast: -1 },
      $set: { stationVoteFinal: before?.stationVoteFinal === true },
    },
  );
}
