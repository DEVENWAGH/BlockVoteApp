/**
 * Plain-language messages shared by the station portal, the Android API and
 * the admin screens. Keep them short and free of technical words.
 */
export const VOTER_MESSAGES = Object.freeze({
  NOT_ON_LIST: 'This voter ID is not on the list. Check the ID or ask the booth officer.',
  NOT_ENROLLED: 'This voter is on the roll but not included in this election. Ask the booth officer.',
  CASE_OPEN: 'This voter record is waiting for a guardian to review it. Ask the booth officer.',
  REJECTED: 'This voter could not be registered for the election. Ask the booth officer.',
  NO_CANDIDATES: 'No candidates are listed for your area yet.',
  NOT_OPEN: 'This election is not open yet.',
  CLOSED: 'This election has closed.',
  WRONG_SEAT: 'That candidate is not on your ballot. Choose a candidate from your home area.',
  ALREADY_VOTED_STATION: 'A vote has already been cast at a polling station for this voter. No more votes are allowed.',
});

/** Status label for voters: 0 → Not open, 1 → Voting open, 2 → Closed */
export function phaseLabel(phase) {
  if (Number(phase) === 1) return 'Voting open';
  if (Number(phase) === 2) return 'Closed';
  return 'Not open';
}
