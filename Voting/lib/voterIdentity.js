import { ethers } from 'ethers';
import { getIdentitySecret } from './serverEnv.js';

/**
 * Canonical on-chain voter identity (email-scoped, no organization).
 * Same email → same nullifier across elections (biometric + double-vote binding).
 */
export function computeNullifierHash(email) {
  const secret = getIdentitySecret();
  const cleanEmail = email.toLowerCase().trim();
  return ethers.keccak256(
    ethers.toUtf8Bytes(`${cleanEmail}:${secret}`),
  );
}

export function isAlreadyRegisteredError(err) {
  const msg = err?.reason || err?.message || String(err);
  return msg.includes('already registered');
}
