/**
 * lib/rollValidation.js
 * Master-roll CSV rows: column aliases, normalization, required-field checks
 * and duplicate detection against the existing roll.
 *
 * Pure functions — no database access — so they can be unit tested.
 */
import { normalizeVoterId, normalizeEmail } from './voterIdentity.js';
import { normalizeCode, normalizePlace } from './seats.js';

export const ROLL_COLUMNS = [
  'voterId',
  'name',
  'email',
  'phone',
  'gender',
  'age',
  'state',
  'district',
  'city',
  'village',
  'ward',
  'partNo',
  'homePollingStation',
  'assemblyConstituency',
  'parliamentaryConstituency',
];

/** Optional analytics-only columns accepted but not required. */
export const OPTIONAL_ROLL_COLUMNS = ['localityType', 'cityTier'];

/** Header aliases (lower-cased, punctuation stripped) → canonical column. */
const ALIASES = {
  voterid: 'voterId',
  voter_id: 'voterId',
  epic: 'voterId',
  epicno: 'voterId',
  epicnumber: 'voterId',
  idcardno: 'voterId',
  voteridno: 'voterId',
  name: 'name',
  fullname: 'name',
  votername: 'name',
  electorname: 'name',
  email: 'email',
  emailid: 'email',
  emailaddress: 'email',
  mail: 'email',
  phone: 'phone',
  mobile: 'phone',
  mobileno: 'phone',
  phonenumber: 'phone',
  contact: 'phone',
  gender: 'gender',
  sex: 'gender',
  age: 'age',
  state: 'state',
  region: 'state',
  district: 'district',
  dist: 'district',
  city: 'city',
  town: 'city',
  municipality: 'city',
  village: 'village',
  gram: 'village',
  grampanchayat: 'village',
  panchayat: 'village',
  ward: 'ward',
  wardno: 'ward',
  wardnumber: 'ward',
  partno: 'partNo',
  part: 'partNo',
  partnumber: 'partNo',
  homepollingstation: 'homePollingStation',
  pollingstation: 'homePollingStation',
  ps: 'homePollingStation',
  booth: 'homePollingStation',
  psname: 'homePollingStation',
  assemblyconstituency: 'assemblyConstituency',
  ac: 'assemblyConstituency',
  acno: 'assemblyConstituency',
  accode: 'assemblyConstituency',
  assembly: 'assemblyConstituency',
  vidhansabha: 'assemblyConstituency',
  parliamentaryconstituency: 'parliamentaryConstituency',
  pc: 'parliamentaryConstituency',
  pcno: 'parliamentaryConstituency',
  pccode: 'parliamentaryConstituency',
  loksabha: 'parliamentaryConstituency',
  parliament: 'parliamentaryConstituency',
  localitytype: 'localityType',
  citytier: 'cityTier',
  tier: 'cityTier',
};

export function canonicalColumn(header) {
  const key = String(header || '')
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return ALIASES[key] || null;
}

/** Map a raw CSV header list to canonical columns. Unknown headers are kept out. */
export function mapHeaders(headers) {
  const mapping = {};
  const unknown = [];
  for (const h of headers || []) {
    const canon = canonicalColumn(h);
    if (canon) mapping[h] = canon;
    else if (String(h || '').trim()) unknown.push(String(h).trim());
  }
  return { mapping, unknown };
}

function clean(value, max = 120) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanPhone(value) {
  const digits = String(value ?? '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  // Keep the last 10 digits for Indian mobiles so "+91 98765 43210" == "9876543210"
  const bare = digits.replace(/^\+?91/, '').replace(/\D/g, '');
  return bare.length >= 10 ? bare.slice(-10) : bare;
}

function cleanGender(value) {
  const g = clean(value).toLowerCase();
  if (!g) return '';
  if (['m', 'male', 'man', 'पुरुष'].includes(g)) return 'male';
  if (['f', 'female', 'woman', 'महिला'].includes(g)) return 'female';
  if (['o', 'other', 'others', 'third gender', 'transgender', 'tg'].includes(g)) return 'other';
  return g;
}

function cleanAge(value) {
  const n = Number(String(value ?? '').trim());
  return Number.isFinite(n) && n > 0 && n < 130 ? Math.floor(n) : null;
}

/** Normalize a raw row (already keyed by canonical column names). */
export function normalizeRollRow(raw = {}) {
  return {
    voterId: normalizeVoterId(raw.voterId),
    name: clean(raw.name, 120),
    email: normalizeEmail(raw.email),
    phone: cleanPhone(raw.phone),
    gender: cleanGender(raw.gender),
    age: cleanAge(raw.age),
    state: clean(raw.state, 60),
    district: clean(raw.district, 60),
    city: clean(raw.city, 80),
    village: clean(raw.village, 80),
    ward: clean(raw.ward, 40),
    partNo: clean(raw.partNo, 20),
    homePollingStation: clean(raw.homePollingStation, 120),
    assemblyConstituency: normalizeCode(raw.assemblyConstituency),
    parliamentaryConstituency: normalizeCode(raw.parliamentaryConstituency),
    localityType: clean(raw.localityType, 20).toLowerCase(),
    cityTier: clean(raw.cityTier, 20),
  };
}

/** Re-key a parsed CSV record using a header mapping and normalize it. */
export function rowFromRecord(record, mapping) {
  const keyed = {};
  for (const [rawHeader, canon] of Object.entries(mapping)) {
    if (record[rawHeader] !== undefined && record[rawHeader] !== null && String(record[rawHeader]).trim() !== '') {
      keyed[canon] = record[rawHeader];
    }
  }
  return normalizeRollRow(keyed);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VOTER_ID_RE = /^[A-Z0-9/-]{4,20}$/;

/**
 * Required-field and seat checks. Returns { ok, missing, reasons }.
 *
 * `seatCodes` is a Set of known constituency codes (all levels). A seat code
 * on the row must exist in the shared seat list, otherwise the row is a
 * "missing" case that the guardian can only send back.
 */
export function validateRollRow(row, { seatCodes } = {}) {
  const missing = [];
  const reasons = [];

  if (!row.voterId) missing.push('voterId');
  else if (!VOTER_ID_RE.test(row.voterId)) reasons.push('Voter ID should be 4–20 letters or digits.');

  if (!row.name) missing.push('name');
  if (!row.email) missing.push('email');
  else if (!EMAIL_RE.test(row.email)) reasons.push('Email address does not look valid.');

  if (!row.state) missing.push('state');

  const hasSeat = Boolean(row.assemblyConstituency || row.parliamentaryConstituency);
  const hasPlace = Boolean(row.village || row.city);
  if (!hasSeat && !hasPlace) {
    missing.push('assemblyConstituency or parliamentaryConstituency (or a village / city)');
  }

  if (seatCodes) {
    if (row.assemblyConstituency && !seatCodes.has(row.assemblyConstituency)) {
      reasons.push(`Assembly seat "${row.assemblyConstituency}" is not in the seat list.`);
    }
    if (row.parliamentaryConstituency && !seatCodes.has(row.parliamentaryConstituency)) {
      reasons.push(`Lok Sabha seat "${row.parliamentaryConstituency}" is not in the seat list.`);
    }
  }

  if (missing.length) reasons.unshift(`Missing: ${missing.join(', ')}.`);
  return { ok: reasons.length === 0, missing, reasons };
}

/** Fields that matter when comparing a new row with the existing person. */
export const COMPARE_FIELDS = [
  'name',
  'email',
  'phone',
  'gender',
  'age',
  'state',
  'district',
  'city',
  'village',
  'ward',
  'partNo',
  'homePollingStation',
  'assemblyConstituency',
  'parliamentaryConstituency',
];

function same(a, b, field) {
  if (field === 'age') return (a ?? null) === (b ?? null);
  if (field === 'email') return normalizeEmail(a) === normalizeEmail(b);
  if (field === 'assemblyConstituency' || field === 'parliamentaryConstituency') {
    return normalizeCode(a) === normalizeCode(b);
  }
  if (field === 'phone') return cleanPhone(a) === cleanPhone(b);
  return normalizePlace(a) === normalizePlace(b);
}

/** Which fields differ between the new row and the existing roll entry. */
export function diffRows(newRow, existing) {
  const differences = [];
  for (const field of COMPARE_FIELDS) {
    const incoming = newRow?.[field];
    // A blank cell in the file means "no change", not "erase".
    if (incoming === '' || incoming === null || incoming === undefined) continue;
    if (!same(incoming, existing?.[field], field)) differences.push(field);
  }
  return differences;
}

export function rowsIdentical(newRow, existing) {
  return diffRows(newRow, existing).length === 0;
}

/** Plain-language field labels for the guardian comparison screen. */
export const FIELD_LABELS = Object.freeze({
  voterId: 'Voter ID',
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  gender: 'Gender',
  age: 'Age',
  state: 'State',
  district: 'District',
  city: 'City',
  village: 'Village',
  ward: 'Ward',
  partNo: 'Part no.',
  homePollingStation: 'Home polling station',
  assemblyConstituency: 'Assembly seat',
  parliamentaryConstituency: 'Lok Sabha seat',
});

/**
 * Decide what to do with one normalized row.
 *
 * @param row            normalized row
 * @param ctx.byVoterId  Map voterId → existing voter (lean)
 * @param ctx.byEmail    Map email → existing voter
 * @param ctx.byPhone    Map phone → existing voter(s)
 * @param ctx.seenInFile Set of voterIds already seen earlier in this file
 * @param ctx.seatCodes  Set of known seat codes
 * @returns { action: 'add'|'skip'|'missing'|'duplicate', reasons, matchedOn, existing }
 */
export function classifyRow(row, ctx) {
  const validation = validateRollRow(row, { seatCodes: ctx.seatCodes });
  if (!validation.ok) {
    return { action: 'missing', reasons: validation.reasons, matchedOn: [], existing: null };
  }

  if (ctx.seenInFile?.has(row.voterId)) {
    return {
      action: 'duplicate',
      reasons: ['This voter ID appears more than once in the file.'],
      matchedOn: ['file'],
      existing: ctx.byVoterId?.get(row.voterId) || null,
    };
  }

  const existingById = ctx.byVoterId?.get(row.voterId);
  if (existingById) {
    const differences = diffRows(row, existingById);
    if (differences.length === 0) {
      return { action: 'skip', reasons: [], matchedOn: ['voterId'], existing: existingById };
    }
    return {
      action: 'duplicate',
      reasons: [
        `Voter ID already on the roll with different ${differences
          .map((f) => FIELD_LABELS[f] || f)
          .join(', ')}.`,
      ],
      matchedOn: ['voterId'],
      existing: existingById,
      differences,
    };
  }

  const existingByEmail = ctx.byEmail?.get(row.email);
  if (existingByEmail && existingByEmail.voterId !== row.voterId) {
    return {
      action: 'duplicate',
      reasons: [`Email is already used by voter ID ${existingByEmail.voterId}.`],
      matchedOn: ['email'],
      existing: existingByEmail,
      differences: diffRows(row, existingByEmail),
    };
  }

  if (row.phone) {
    const phoneMatches = ctx.byPhone?.get(row.phone) || [];
    const sameName = phoneMatches.find(
      (v) => v.voterId !== row.voterId && normalizePlace(v.name) === normalizePlace(row.name),
    );
    if (sameName) {
      return {
        action: 'duplicate',
        reasons: [`Same name and phone as voter ID ${sameName.voterId}.`],
        matchedOn: ['phone+name'],
        existing: sameName,
        differences: diffRows(row, sameName),
      };
    }
  }

  return { action: 'add', reasons: [], matchedOn: [], existing: null };
}
