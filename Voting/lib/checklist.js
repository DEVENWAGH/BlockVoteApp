/**
 * lib/checklist.js
 * "Ready to open voting?" — the plain-language checklist a guardian sees
 * before approving an election, and staff see on the dashboard.
 */
import Candidate from './models/Candidate.js';
import Enrollment from './models/Enrollment.js';
import Constituency from './models/Constituency.js';
import VoterCase from './models/VoterCase.js';
import Party from './models/Party.js';
import { usesSeatFiltering } from './seats.js';

export async function electionChecklist(election) {
  const electionId = String(election.electionId);
  const filtered = usesSeatFiltering(election);

  const [candidates, enrolledTotal, enrolledRegistered, openCases, openCasesTotal, partyCount] = await Promise.all([
    Candidate.find({ electionId }).select('candidateId partyCode constituencyCode').lean(),
    Enrollment.countDocuments({ electionId }),
    Enrollment.countDocuments({ electionId, status: 'registered' }),
    openCaseCountForElection(electionId),
    VoterCase.countDocuments({ status: 'open' }),
    Party.countDocuments({}),
  ]);

  const candidateCount = Math.max(candidates.length, election.candidateCount || 0);
  const seatCodes = [...new Set(candidates.map((c) => c.constituencyCode).filter(Boolean))];

  // Seats that have enrolled voters but no candidate yet.
  let seatsWithVoters = [];
  let seatsMissingCandidates = [];
  if (filtered) {
    const seatRows = await Enrollment.aggregate([
      { $match: { electionId, constituencyCode: { $ne: '' } } },
      { $group: { _id: '$constituencyCode', voters: { $sum: 1 } } },
    ]);
    seatsWithVoters = seatRows.map((r) => r._id);
    const haveCandidates = new Set(seatCodes);
    seatsMissingCandidates = seatsWithVoters.filter((code) => !haveCandidates.has(code));
  }

  const seatNames = filtered && (seatCodes.length || seatsMissingCandidates.length)
    ? await Constituency.find({ code: { $in: [...seatCodes, ...seatsMissingCandidates] } }).select('code name').lean()
    : [];
  const nameByCode = new Map(seatNames.map((s) => [s.code, s.name]));

  const items = [
    {
      key: 'parties',
      label: 'Parties with symbols added',
      ok: !filtered || partyCount > 0,
      detail: `${partyCount} part${partyCount === 1 ? 'y' : 'ies'} in the shared list`,
    },
  ];

  if (filtered) {
    items.push({
      key: 'seats',
      label: 'Seats set up',
      ok: seatsWithVoters.length > 0,
      detail: seatsWithVoters.length
        ? `${seatsWithVoters.length} seat${seatsWithVoters.length === 1 ? '' : 's'} with voters`
        : 'No voters are matched to a seat yet',
    });
    items.push({
      key: 'candidates',
      label: 'Every seat has at least one candidate',
      ok: candidateCount > 0 && seatsMissingCandidates.length === 0,
      detail: seatsMissingCandidates.length
        ? `Missing in: ${seatsMissingCandidates.slice(0, 5).map((c) => nameByCode.get(c) || c).join(', ')}${seatsMissingCandidates.length > 5 ? '…' : ''}`
        : `${candidateCount} candidate${candidateCount === 1 ? '' : 's'} across ${seatCodes.length} seat${seatCodes.length === 1 ? '' : 's'}`,
    });
  } else {
    items.push({
      key: 'candidates',
      label: 'At least one candidate added',
      ok: candidateCount > 0,
      detail: `${candidateCount} candidate${candidateCount === 1 ? '' : 's'}`,
    });
  }

  items.push({
    key: 'voters',
    label: 'Voters enrolled',
    ok: enrolledTotal > 0,
    detail: enrolledTotal
      ? `${enrolledTotal.toLocaleString()} enrolled, ${enrolledRegistered.toLocaleString()} registered`
      : 'Nobody is enrolled yet',
  });

  items.push({
    key: 'cases',
    label: 'No voter cases waiting',
    ok: openCases === 0,
    detail: openCases
      ? `${openCases} case${openCases === 1 ? '' : 's'} for people in this election need a guardian decision`
      : openCasesTotal
        ? `All clear for this election (${openCasesTotal} other case${openCasesTotal === 1 ? '' : 's'} open on the roll)`
        : 'All clear',
  });

  return {
    ready: items.every((i) => i.ok),
    items,
    counts: {
      parties: partyCount,
      candidates: candidateCount,
      seats: seatsWithVoters.length,
      seatsMissingCandidates: seatsMissingCandidates.length,
      enrolled: enrolledTotal,
      registered: enrolledRegistered,
      openCases,
      openCasesTotal,
    },
  };
}

/** Open cases involving anyone enrolled in this election. */
export async function openCaseCountForElection(electionId) {
  const open = await VoterCase.find({ status: 'open' }, { 'newRow.voterId': 1, existingVoterId: 1 }).lean();
  if (!open.length) return 0;
  const ids = new Set();
  for (const c of open) {
    if (c.newRow?.voterId) ids.add(c.newRow.voterId);
    if (c.existingVoterId) ids.add(c.existingVoterId);
  }
  if (!ids.size) return 0;
  const enrolled = await Enrollment.find(
    { electionId: String(electionId), voterId: { $in: [...ids] } },
    { voterId: 1 },
  ).lean();
  const enrolledIds = new Set(enrolled.map((e) => e.voterId));
  let count = 0;
  for (const c of open) {
    if (enrolledIds.has(c.newRow?.voterId) || enrolledIds.has(c.existingVoterId)) count += 1;
  }
  return count;
}
