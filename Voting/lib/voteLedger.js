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
