/**
 * lib/votingWindow.js
 * Fixed daily polling hours (default 7:00 AM – 6:00 PM IST, like Indian polling booths),
 * applied inside each election's start/end dates.
 *
 * Env overrides: VOTING_OPEN_TIME=HH:MM, VOTING_CLOSE_TIME=HH:MM, VOTING_TIMEZONE=IANA zone.
 */

const DEFAULT_TIMEZONE = 'Asia/Kolkata';
const DEFAULT_OPEN_MINUTES = 7 * 60;
const DEFAULT_CLOSE_MINUTES = 18 * 60;
const TIMEZONE_LABELS = { 'Asia/Kolkata': 'IST' };

function parseClock(value, fallback) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return hours * 60 + minutes;
}

export function getVotingHoursConfig(env = process.env) {
  return {
    openMinutes: parseClock(env.VOTING_OPEN_TIME, DEFAULT_OPEN_MINUTES),
    closeMinutes: parseClock(env.VOTING_CLOSE_TIME, DEFAULT_CLOSE_MINUTES),
    timeZone: env.VOTING_TIMEZONE || DEFAULT_TIMEZONE,
  };
}

function minutesInZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function formatClock(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatDate(date, timeZone) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function describeVotingHours(config = getVotingHoursConfig()) {
  const zone = TIMEZONE_LABELS[config.timeZone] || config.timeZone;
  if (config.openMinutes === config.closeMinutes) return `Open all day (${zone})`;
  return `${formatClock(config.openMinutes)} – ${formatClock(config.closeMinutes)} ${zone}`;
}

function isWithinDailyHours(minutes, { openMinutes, closeMinutes }) {
  if (openMinutes === closeMinutes) return true;
  if (openMinutes < closeMinutes) return minutes >= openMinutes && minutes < closeMinutes;
  return minutes >= openMinutes || minutes < closeMinutes;
}

/**
 * Is voting open right now for this election?
 * Returns { open, code, reason, hours, opensAt, closesAt, timeZone }.
 * code: OPEN | NOT_STARTED | ELECTION_ENDED | OUTSIDE_HOURS
 */
export function getVotingWindowStatus(
  election,
  { now = new Date(), config = getVotingHoursConfig() } = {},
) {
  const zone = TIMEZONE_LABELS[config.timeZone] || config.timeZone;
  const base = {
    hours: describeVotingHours(config),
    opensAt: `${formatClock(config.openMinutes)} ${zone}`,
    closesAt: `${formatClock(config.closeMinutes)} ${zone}`,
    timeZone: config.timeZone,
  };

  const start = election?.startTime ? new Date(election.startTime) : null;
  const end = election?.endTime ? new Date(election.endTime) : null;

  if (start && !Number.isNaN(start.getTime()) && now < start) {
    return {
      ...base,
      open: false,
      code: 'NOT_STARTED',
      reason: `Voting for this election starts on ${formatDate(start, config.timeZone)}. Polling hours are ${base.hours}.`,
    };
  }

  if (end && !Number.isNaN(end.getTime()) && now >= end) {
    return {
      ...base,
      open: false,
      code: 'ELECTION_ENDED',
      reason: 'Voting for this election has ended.',
    };
  }

  if (!isWithinDailyHours(minutesInZone(now, config.timeZone), config)) {
    return {
      ...base,
      open: false,
      code: 'OUTSIDE_HOURS',
      reason: `Polls are closed right now. Voting is open daily from ${base.hours}.`,
    };
  }

  return {
    ...base,
    open: true,
    code: 'OPEN',
    reason: `Polls are open until ${base.closesAt}.`,
  };
}
