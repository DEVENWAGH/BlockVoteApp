/**
 * lib/seats.js
 * Which seat does this voter vote for in this election?
 *
 * The answer comes from the master roll and the election level — never from
 * the booth the voter is standing in or the device's GPS.
 */
import Constituency from './models/Constituency.js';

export const LEVEL_LABELS = Object.freeze({
  general: 'Single ballot (everyone sees the same candidates)',
  panchayat: 'Gram panchayat / village ward',
  municipal: 'Municipal ward',
  assembly: 'Assembly seat (MLA)',
  loksabha: 'Lok Sabha seat (MP)',
});

export const LEVEL_SHORT = Object.freeze({
  general: 'Single ballot',
  panchayat: 'Panchayat',
  municipal: 'Municipal',
  assembly: 'Assembly',
  loksabha: 'Lok Sabha',
});

export function normalizePlace(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

/** Single-ballot elections show every candidate to every enrolled voter. */
export function usesSeatFiltering(election) {
  const level = election?.level || 'general';
  return level !== 'general';
}

/** Seat code stored directly on the roll for the given level, or '' when it must be matched by place. */
export function directSeatCode(voter, level) {
  if (level === 'assembly') return normalizeCode(voter?.assemblyConstituency);
  if (level === 'loksabha') return normalizeCode(voter?.parliamentaryConstituency);
  return '';
}

/**
 * For panchayat / municipal seats the roll has a place, not a code. Match the
 * voter's home place against the seat list. A seat with a ward wins over one
 * without, so "Ward 4" beats the whole village.
 */
export function seatMatchesVoter(seat, voter) {
  if (!seat || !voter) return false;
  if (normalizePlace(seat.state) !== normalizePlace(voter.state)) return false;
  if (seat.district && normalizePlace(seat.district) !== normalizePlace(voter.district)) return false;

  if (seat.level === 'municipal') {
    if (!seat.city || normalizePlace(seat.city) !== normalizePlace(voter.city)) return false;
  } else if (seat.level === 'panchayat') {
    if (!seat.village || normalizePlace(seat.village) !== normalizePlace(voter.village)) return false;
  } else {
    return false;
  }

  if (seat.ward && normalizePlace(seat.ward) !== normalizePlace(voter.ward)) return false;
  return true;
}

export function pickSeatByPlace(seats, voter) {
  const matches = (seats || []).filter((s) => seatMatchesVoter(s, voter));
  if (matches.length === 0) return null;
  matches.sort((a, b) => (b.ward ? 1 : 0) - (a.ward ? 1 : 0));
  return matches[0];
}

/**
 * Resolve { code, seat } for a voter in an election.
 * `seatsOfLevel` may be passed to avoid a query per voter during bulk enrollment.
 */
export async function resolveSeatForVoter(voter, election, seatsOfLevel) {
  const level = election?.level || 'general';
  if (level === 'general') return { code: '', seat: null };

  const direct = directSeatCode(voter, level);
  if (direct) {
    const seat = seatsOfLevel
      ? seatsOfLevel.find((s) => s.code === direct) || null
      : await Constituency.findOne({ code: direct }).lean();
    return { code: direct, seat };
  }

  if (level === 'panchayat' || level === 'municipal') {
    const seats = seatsOfLevel || (await Constituency.find({ level }).lean());
    const seat = pickSeatByPlace(seats, voter);
    return { code: seat?.code || '', seat };
  }

  return { code: '', seat: null };
}

export async function listSeatsForLevel(level) {
  if (!level || level === 'general') return [];
  return Constituency.find({ level }).sort({ state: 1, district: 1, name: 1 }).lean();
}

/** Plain-language seat line for the voter slip, e.g. "Karad North Assembly". */
export function describeSeat(seat, level) {
  if (!seat) return '';
  const suffix = {
    assembly: 'Assembly',
    loksabha: 'Lok Sabha',
    municipal: 'Ward',
    panchayat: 'Panchayat',
  }[seat.level || level] || '';
  return suffix && !new RegExp(suffix, 'i').test(seat.name) ? `${seat.name} ${suffix}` : seat.name;
}
