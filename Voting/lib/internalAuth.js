/**
 * lib/internalAuth.js
 * Server-to-server routes (event-listener sync, relay integrations) require
 * an x-relay-api-key header matching ADMIN_API_KEY. Unset key = always denied.
 */
import crypto from 'crypto';

export const INTERNAL_KEY_HEADER = 'x-relay-api-key';

export function isValidInternalKey(provided, expected = process.env.ADMIN_API_KEY) {
  if (!expected || !provided) return false;
  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(provided));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function hasInternalKey(req) {
  return isValidInternalKey(req.headers.get(INTERNAL_KEY_HEADER) || '');
}
