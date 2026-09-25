/**
 * lib/serverEnv.js
 * Server configuration lookups. Local development may use built-in fallbacks;
 * production refuses to run with a missing secret or public URL.
 */

export function isProduction(env = process.env) {
  return env.NODE_ENV === 'production';
}

/** First non-empty value among `names`; in production a missing value throws. */
export function readServerEnv(names, devFallback, env = process.env) {
  const list = [].concat(names);
  for (const name of list) {
    const value = env[name];
    if (value && String(value).trim()) return String(value).trim();
  }
  if (isProduction(env)) {
    throw new Error(`${list.join(' or ')} must be set in production`);
  }
  return devFallback;
}

export function getIdentitySecret(env = process.env) {
  return readServerEnv('SERVER_IDENTITY_SECRET', 'dev-identity-secret-change-in-prod-12345', env);
}

export function getJwtSecret(env = process.env) {
  return readServerEnv('JWT_SECRET', 'dev-jwt-secret-change-in-prod-54321', env);
}

export function getStationSecret(env = process.env) {
  return readServerEnv(['STATION_SESSION_SECRET', 'JWT_SECRET'], 'dev-jwt-secret-change-in-prod-54321', env);
}

/** Public site origin used in emails and share links, without a trailing slash. */
export function getPublicBaseUrl(env = process.env) {
  return readServerEnv(
    ['NEXT_PUBLIC_APP_URL', 'APP_URL', 'NEXTAUTH_URL', 'NEXT_PUBLIC_BASE_URL'],
    'http://localhost:3000',
    env,
  ).replace(/\/+$/, '');
}

/** JSON-RPC endpoint for the chain the contract is deployed on. */
export function getRpcUrl(env = process.env) {
  return readServerEnv(['RPC_URL', 'NEXT_PUBLIC_RPC_URL'], 'http://127.0.0.1:8545', env);
}
