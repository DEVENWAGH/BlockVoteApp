/**
 * Voting hours + vote allowance unit tests (pure functions, no DB).
 * Run: yarn test
 */
import { expect } from 'chai';
import { getVotingWindowStatus, getVotingHoursConfig, describeVotingHours } from '../lib/votingWindow.js';
import { checkVoteAllowance, appVotesRemainingAfter, MAX_APP_VOTES, VOTE_CHANNEL } from '../lib/voteAllowance.js';
import { issueStationToken, verifyStationToken } from '../lib/stationSession.js';

const IST = getVotingHoursConfig({});

/** IST wall-clock time → Date (IST is UTC+5:30, no DST). */
function ist(y, m, d, hh, mm = 0) {
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - (5 * 60 + 30) * 60 * 1000);
}

const election = {
  startTime: ist(2026, 9, 26, 0, 0),
  endTime: ist(2026, 9, 28, 23, 59),
};

describe('votingWindow — daily polling hours', () => {
  it('W1 defaults to 7:00 AM – 6:00 PM IST', () => {
    expect(describeVotingHours(IST)).to.equal('7:00 AM – 6:00 PM IST');
  });

  it('W2 open at 7:00 AM sharp', () => {
    const s = getVotingWindowStatus(election, { now: ist(2026, 9, 26, 7, 0), config: IST });
    expect(s.open).to.equal(true);
    expect(s.code).to.equal('OPEN');
  });

  it('W3 closed at 6:59 AM', () => {
    const s = getVotingWindowStatus(election, { now: ist(2026, 9, 26, 6, 59), config: IST });
    expect(s.open).to.equal(false);
    expect(s.code).to.equal('OUTSIDE_HOURS');
  });

  it('W4 open at 5:59 PM, closed at 6:00 PM', () => {
    expect(getVotingWindowStatus(election, { now: ist(2026, 9, 27, 17, 59), config: IST }).open).to.equal(true);
    const closed = getVotingWindowStatus(election, { now: ist(2026, 9, 27, 18, 0), config: IST });
    expect(closed.open).to.equal(false);
    expect(closed.reason).to.include('7:00 AM – 6:00 PM IST');
  });

  it('W5 closed before the election start date even within hours', () => {
    const s = getVotingWindowStatus(election, { now: ist(2026, 9, 25, 10, 0), config: IST });
    expect(s.open).to.equal(false);
    expect(s.code).to.equal('NOT_STARTED');
  });

  it('W6 closed after the election end date', () => {
    const s = getVotingWindowStatus(election, { now: ist(2026, 9, 29, 10, 0), config: IST });
    expect(s.open).to.equal(false);
    expect(s.code).to.equal('ELECTION_ENDED');
  });

  it('W7 env overrides are respected and invalid values fall back', () => {
    const cfg = getVotingHoursConfig({ VOTING_OPEN_TIME: '08:30', VOTING_CLOSE_TIME: '99:00' });
    expect(cfg.openMinutes).to.equal(8 * 60 + 30);
    expect(cfg.closeMinutes).to.equal(18 * 60);
  });
});

describe('voteAllowance — first vote + one change, station is final', () => {
  it('A1 first app vote allowed', () => {
    const r = checkVoteAllowance({ votesCast: 0 }, VOTE_CHANNEL.APP);
    expect(r.allowed).to.equal(true);
    expect(r.isRevote).to.equal(false);
  });

  it('A2 second app vote allowed as a change', () => {
    const r = checkVoteAllowance({ votesCast: 1 }, VOTE_CHANNEL.APP);
    expect(r.allowed).to.equal(true);
    expect(r.code).to.equal('REVOTE_ALLOWED');
  });

  it('A3 third app vote blocked', () => {
    const r = checkVoteAllowance({ votesCast: MAX_APP_VOTES }, VOTE_CHANNEL.APP);
    expect(r.allowed).to.equal(false);
    expect(r.code).to.equal('VOTE_LIMIT_REACHED');
  });

  it('A4 station vote overrides even after both app votes', () => {
    const r = checkVoteAllowance({ votesCast: MAX_APP_VOTES }, VOTE_CHANNEL.STATION);
    expect(r.allowed).to.equal(true);
    expect(r.code).to.equal('STATION_OVERRIDE');
    expect(r.final).to.equal(true);
  });

  it('A5 nothing allowed after a station vote', () => {
    const voter = { votesCast: 1, stationVoteFinal: true };
    expect(checkVoteAllowance(voter, VOTE_CHANNEL.APP).code).to.equal('STATION_VOTE_FINAL');
    expect(checkVoteAllowance(voter, VOTE_CHANNEL.STATION).code).to.equal('STATION_VOTE_FINAL');
  });

  it('A6 legacy voter without votesCast is treated as not voted', () => {
    expect(checkVoteAllowance({}, VOTE_CHANNEL.APP).code).to.equal('ALLOWED');
  });

  it('A7 remaining app changes after each cast', () => {
    expect(appVotesRemainingAfter(1, VOTE_CHANNEL.APP)).to.equal(1);
    expect(appVotesRemainingAfter(2, VOTE_CHANNEL.APP)).to.equal(0);
    expect(appVotesRemainingAfter(1, VOTE_CHANNEL.STATION)).to.equal(0);
  });
});

describe('stationSession — signed station token', () => {
  it('S1 round-trips a valid token', () => {
    const { token } = issueStationToken({ electionId: '0xabc', stationName: 'Booth 1', adminId: 'a1' });
    const payload = verifyStationToken(token);
    expect(payload.electionId).to.equal('0xabc');
    expect(payload.stationName).to.equal('Booth 1');
  });

  it('S2 rejects a tampered payload', () => {
    const { token } = issueStationToken({ electionId: '0xabc', stationName: 'Booth 1', adminId: 'a1' });
    const [, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ typ: 'station', electionId: '0xother', exp: 9999999999 }))
      .toString('base64url');
    expect(verifyStationToken(`${forged}.${sig}`)).to.equal(null);
  });

  it('S3 rejects garbage', () => {
    expect(verifyStationToken('nope')).to.equal(null);
    expect(verifyStationToken('')).to.equal(null);
  });
});
