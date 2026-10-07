import { ethers } from 'ethers';
import { getIdentitySecret } from './serverEnv.js';

/** Voter IDs (EPIC) are compared without spaces, upper-cased. */
export function normalizeVoterId(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

export function normalizeEmail(value) {
  return String(value || '').toLowerCase().trim();
}

/** "ABC1234567" → "ABC•••4567". Short IDs keep only the last two characters. */
export function maskVoterId(value) {
  const id = normalizeVoterId(value);
  if (!id) return '';
  if (id.length <= 4) return `${'•'.repeat(Math.max(0, id.length - 2))}${id.slice(-2)}`;
  if (id.length < 8) return `${'•'.repeat(id.length - 4)}${id.slice(-4)}`;
  return `${id.slice(0, 3)}${'•'.repeat(id.length - 7)}${id.slice(-4)}`;
}

/** "ravi.kumar@gmail.com" → "r•••••••••@gmail.com" */
export function maskEmail(value) {
  const email = normalizeEmail(value);
  const at = email.indexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  return `${local[0]}${'•'.repeat(Math.max(2, local.length - 1))}${email.slice(at)}`;
}

/**
 * Canonical on-chain voter identity.
 *
 * With a voter ID and election: keccak256(voterId:electionId:secret) — two
 * emails can never create two voters, and a person is one nullifier per election.
 *
 * Legacy (email only, no election): keccak256(email:secret). Kept so old rows
 * copied into the master roll keep working.
 */
export function computeNullifierHash(identity, electionId) {
  const secret = getIdentitySecret();
  if (!electionId) {
    const cleanEmail = normalizeEmail(identity);
    return ethers.keccak256(ethers.toUtf8Bytes(`${cleanEmail}:${secret}`));
  }
  const cleanId = normalizeVoterId(identity);
  return ethers.keccak256(
    ethers.toUtf8Bytes(`${cleanId}:${String(electionId)}:${secret}`),
  );
}

export function isAlreadyRegisteredError(err) {
  const msg = err?.reason || err?.message || String(err);
  return msg.includes('already registered');
}
