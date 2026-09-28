/**
 * Security headers for Next.js (next.config headers) and legacy middleware.
 * Kept in one module so CSP/env logic stays consistent.
 */

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(self), payment=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-XSS-Protection': '1; mode=block',
};

function buildS3ImgSrc() {
  const sources = new Set(['https://*.s3.amazonaws.com']);

  const publicUrl = process.env.AWS_S3_PUBLIC_URL;
  if (publicUrl) {
    try {
      sources.add(`https://${new URL(publicUrl).hostname}`);
    } catch {
      // ignore invalid AWS_S3_PUBLIC_URL
    }
  }

  const region = process.env.AWS_REGION || process.env.AWS_S3_REGION;
  if (region && region !== 'us-east-1') {
    sources.add(`https://*.s3.${region}.amazonaws.com`);
  }

  const bucket = process.env.AWS_S3_BUCKET;
  if (bucket && region) {
    const host =
      region === 'us-east-1'
        ? `${bucket}.s3.amazonaws.com`
        : `${bucket}.s3.${region}.amazonaws.com`;
    sources.add(`https://${host}`);
  }

  return Array.from(sources).join(' ');
}

const S3_IMG_SRC = buildS3ImgSrc();

const VOTE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `img-src 'self' data: blob: https://ik.imagekit.io https://*.ftcdn.net ${S3_IMG_SRC}`,
  "media-src 'self' blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const DEFAULT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `img-src 'self' data: blob: https://ik.imagekit.io https://*.ftcdn.net ${S3_IMG_SRC}`,
  "media-src 'self' blob:",
  "connect-src 'self' https://nominatim.openstreetmap.org https://api.pinata.cloud https://*.pinata.cloud",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function toHeaderEntries(csp) {
  return Object.entries(SECURITY_HEADERS).map(([key, value]) => ({
    key,
    value,
  })).concat([{ key: 'Content-Security-Policy', value: csp }]);
}

/** Route patterns for next.config.js `headers()`. */
function buildSecurityHeaderRoutes() {
  const defaultHeaders = toHeaderEntries(DEFAULT_CSP);
  const voteHeaders = toHeaderEntries(VOTE_CSP);

  return [
    { source: '/vote/:path*', headers: voteHeaders },
    { source: '/org/:path*', headers: voteHeaders },
    { source: '/api/auth/verify-otp', headers: voteHeaders },
    { source: '/:path*', headers: defaultHeaders },
  ];
}

export {
  SECURITY_HEADERS,
  VOTE_CSP,
  DEFAULT_CSP,
  buildS3ImgSrc,
  buildSecurityHeaderRoutes,
};
