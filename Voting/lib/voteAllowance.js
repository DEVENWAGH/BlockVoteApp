/**
 * lib/voteAllowance.js
 * How many times a voter may cast a ballot.
 *
 * - App (remote) voting: 2 casts — the first vote plus one change of mind. Latest counts.
 * - Polling station (web portal): always allowed unless a station vote already exists.
 *   A station vote is FINAL — it overrides any app vote and locks the voter.
 *   This protects voters who were coerced into voting at home.
 */

export const MAX_APP_VOTES = 2;

export const VOTE_CHANNEL = Object.freeze({
  APP: 'app',
  STATION: 'station',
});

export function checkVoteAllowance(voter, channel = VOTE_CHANNEL.APP) {
  const votesCast = Math.max(0, Number(voter?.votesCast) || 0);
  const isRevote = votesCast > 0;

  if (voter?.stationVoteFinal === true) {
    return {
      allowed: false,
      code: 'STATION_VOTE_FINAL',
      reason: 'You already voted at a polling station. A polling-station vote is final and cannot be changed.',
      votesCast,
      isRevote,
    };
  }

  if (channel === VOTE_CHANNEL.STATION) {
    return {
      allowed: true,
      code: isRevote ? 'STATION_OVERRIDE' : 'ALLOWED',
      reason: isRevote
        ? 'This polling-station vote will replace your app vote and will be final.'
        : 'This polling-station vote will be final.',
      votesCast,
      isRevote,
      final: true,
    };
  }

  if (votesCast >= MAX_APP_VOTES) {
    return {
      allowed: false,
      code: 'VOTE_LIMIT_REACHED',
      reason:
        'You have used both app votes (your first vote and one change). To change it again, vote in person at your polling station.',
      votesCast,
      isRevote,
    };
  }

  return {
    allowed: true,
    code: isRevote ? 'REVOTE_ALLOWED' : 'ALLOWED',
    reason: isRevote
      ? 'This vote will replace your previous vote. It is your last change in the app.'
      : 'Vote is eligible. You can change it once later if you change your mind.',
    votesCast,
    isRevote,
    final: false,
  };
}

/** Changes left in the app after a successful cast that brought the total to `votesCast`. */
export function appVotesRemainingAfter(votesCast, channel) {
  if (channel === VOTE_CHANNEL.STATION) return 0;
  return Math.max(0, MAX_APP_VOTES - votesCast);
}
