/**
 * lib/stationSession.js
 * Signed polling-station session. An election admin activates a computer as a
 * polling station for one election; the web ballot only opens on activated computers.
 * Stored in an httpOnly cookie so voters at the kiosk cannot read or forge it.
 */
import crypto from 'crypto';
import { getStationSecret } from './serverEnv.js';

export const STATION_COOKIE = 'bv_station';
export const STATION_TTL_SECONDS = 16 * 60 * 60;

function signingKey() {
  return crypto.createHmac('sha256', getStationSecret()).update('blockvote-station-session').digest();
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function sign(encodedPayload) {
  return base64url(crypto.createHmac('sha256', signingKey()).update(encodedPayload).digest());
}

/**
 * Issue a booth session. `boothId`/`boothCode`/`state`/`district` describe the
 * physical booth; they are recorded on each ballot as *where* it was cast and
 * never decide *which* ballot the voter sees.
 */
export function issueStationToken({
  electionId,
  stationName,
  adminId,
  boothId = '',
  boothCode = '',
  state = '',
  district = '',
}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    typ: 'station',
    stationId: crypto.randomBytes(6).toString('hex'),
    stationName: String(stationName || '').trim().slice(0, 80) || 'Polling station',
    electionId: String(electionId),
    adminId: String(adminId),
    iat: now,
    exp: now + STATION_TTL_SECONDS,
  };
  if (boothId) payload.boothId = String(boothId);
  if (boothCode) payload.boothCode = String(boothCode).trim().toUpperCase().slice(0, 32);
  if (state) payload.state = String(state).trim().slice(0, 60);
  if (district) payload.district = String(district).trim().slice(0, 60);
  const encodedPayload = base64url(JSON.stringify(payload));
  return { token: `${encodedPayload}.${sign(encodedPayload)}`, payload };
}

export function verifyStationToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expected = Buffer.from(sign(encodedPayload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8'));
    if (payload.typ !== 'station' || !payload.electionId) return null;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Reads the station session from the request cookies (route handlers and server components). */
export async function getStationSession() {
  const { cookies } = await import('next/headers');
  const store = await cookies();
  return verifyStationToken(store.get(STATION_COOKIE)?.value);
}

export function stationCookieOptions(maxAge = STATION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge,
  };
}
