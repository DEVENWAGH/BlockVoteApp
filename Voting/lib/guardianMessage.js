/**
 * lib/guardianMessage.js
 * Message a guardian wallet signs to authorise a privileged dashboard action.
 * Shared by the browser (signing) and the server (verification).
 */

export const GUARDIAN_SIGNATURE_TTL_MS = 5 * 60 * 1000;

export function guardianActionMessage({ action, target = '', issuedAt }) {
  return [
    'Block Vote guardian authorisation',
    `Action: ${action}`,
    `Target: ${target || '-'}`,
    `Issued: ${new Date(Number(issuedAt)).toISOString()}`,
  ].join('\n');
}

/** Sign with an ethers Signer; returns the fields the API expects. */
export async function signGuardianAction(signer, { action, target = '' }) {
  if (!signer) throw new Error('Connect your guardian wallet first.');
  const issuedAt = Date.now();
  const signature = await signer.signMessage(guardianActionMessage({ action, target, issuedAt }));
  return { issuedAt, signature };
}
