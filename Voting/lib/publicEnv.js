/**
 * lib/publicEnv.js
 * Browser-visible config. NEXT_PUBLIC_* values are inlined at build time, so
 * they must be referenced literally. Local chain fallback is development-only.
 */

export const PUBLIC_RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:8545');
