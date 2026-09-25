/**
 * lib/guardianAuth.js
 * Server-side verification of guardian-signed actions. A guardian address in
 * the request body is never trusted on its own — the signer is recovered from
 * the signature and checked against configured / on-chain guardians.
 */
import { ethers } from 'ethers';
import { guardianActionMessage, GUARDIAN_SIGNATURE_TTL_MS } from './guardianMessage.js';

function configuredGuardians(env = process.env) {
  return [env.GUARDIAN_1_ADDRESS, env.GUARDIAN_2_ADDRESS, env.GUARDIAN_3_ADDRESS]
    .filter((a) => a && ethers.isAddress(a))
    .map((a) => a.toLowerCase());
}

async function onChainGuardians() {
  try {
    const { getReadContract } = await import('@/lib/relay');
    const list = await getReadContract().getGuardians();
    return Array.from(list)
      .filter((a) => a && a !== ethers.ZeroAddress)
      .map((a) => a.toLowerCase());
  } catch {
    return [];
  }
}

/**
 * Pure check (no network): signature matches message, is fresh, and the
 * signer is in `guardians`. Returns { ok, address?, error? }.
 */
export function checkGuardianSignature(
  { action, target = '', issuedAt, signature },
  guardians,
  now = Date.now(),
) {
  const ts = Number(issuedAt);
  if (!signature || !Number.isFinite(ts)) {
    return { ok: false, error: 'Guardian signature required' };
  }
  if (Math.abs(now - ts) > GUARDIAN_SIGNATURE_TTL_MS) {
    return { ok: false, error: 'Guardian signature expired — please sign again' };
  }
  let address;
  try {
    address = ethers.verifyMessage(guardianActionMessage({ action, target, issuedAt: ts }), signature);
  } catch {
    return { ok: false, error: 'Invalid guardian signature' };
  }
  if (!guardians.includes(address.toLowerCase())) {
    return { ok: false, error: 'Unauthorized — guardian wallet required' };
  }
  return { ok: true, address };
}

export async function verifyGuardianAction(fields) {
  const guardians = [...new Set([...configuredGuardians(), ...(await onChainGuardians())])];
  return checkGuardianSignature(fields, guardians);
}
