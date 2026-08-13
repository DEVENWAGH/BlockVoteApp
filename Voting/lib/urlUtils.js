/** Shared URL helpers (safe for client and server). */

export const PUBLIC_ASSET_PREFIXES = ['party-symbols/', 'candidates/'];

export function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

export function isPublicAssetKey(key) {
  if (!key || typeof key !== 'string') return false;
  const normalized = key.replace(/^\/+/, '');
  return PUBLIC_ASSET_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

/** Build a same-origin proxy path for an S3 object key. */
export function buildAssetProxyPath(key) {
  const normalized = key.replace(/^\/+/, '');
  const encoded = normalized.split('/').map(encodeURIComponent).join('/');
  return `/api/assets/${encoded}`;
}

/**
 * Extract the S3 object key from a virtual-hosted–style S3 URL, or null.
 * Handles regional endpoints and URL-encoded path segments.
 */
export function extractS3KeyFromUrl(url) {
  if (!isHttpUrl(url)) return null;
  try {
    const { hostname, pathname } = new URL(url.trim());
    if (!/\.s3(\.[a-z0-9-]+)?\.amazonaws\.com$/i.test(hostname)) return null;
    const key = decodeURIComponent(pathname.replace(/^\/+/, ''));
    return key || null;
  } catch {
    return null;
  }
}

/**
 * Resolve a stored symbol/photo URL for display.
 * Rewrites direct S3 URLs to the authenticated proxy; leaves proxy URLs unchanged.
 */
export function resolveAssetUrl(value, baseOrigin) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('/api/assets/')) {
    const origin = (baseOrigin || '').replace(/\/$/, '');
    return origin ? `${origin}${trimmed}` : trimmed;
  }

  if (/^https?:\/\/[^/]+\/api\/assets\//i.test(trimmed)) {
    return trimmed;
  }

  const s3Key = extractS3KeyFromUrl(trimmed);
  if (s3Key && isPublicAssetKey(s3Key)) {
    const proxyPath = buildAssetProxyPath(s3Key);
    const origin = (baseOrigin || '').replace(/\/$/, '');
    if (origin) return `${origin}${proxyPath}`;
    if (typeof window !== 'undefined') return proxyPath;
    return proxyPath;
  }

  return trimmed;
}

/** Accept proxy paths and HTTP(S) URLs for on-chain / API validation. */
export function isAllowedAssetUrl(value) {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.startsWith('/api/assets/')) return isPublicAssetKey(trimmed.slice('/api/assets/'.length));
  if (!isHttpUrl(trimmed)) return false;
  if (trimmed.includes('/api/assets/')) {
    try {
      const key = decodeURIComponent(new URL(trimmed).pathname.replace(/^\/api\/assets\/?/, ''));
      return isPublicAssetKey(key);
    } catch {
      return false;
    }
  }
  const s3Key = extractS3KeyFromUrl(trimmed);
  if (s3Key && isPublicAssetKey(s3Key)) return true;
  return isHttpUrl(trimmed);
}
