/**
 * AWS S3 helpers for party symbol and candidate image uploads.
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import {
  buildAssetProxyPath,
  isPublicAssetKey,
} from '@/lib/urlUtils';

let _client = null;

function getS3Client() {
  if (!_client) {
    const region = process.env.AWS_REGION || process.env.AWS_S3_REGION;
    if (!region) {
      throw new Error('AWS_REGION (or AWS_S3_REGION) is not configured.');
    }
    _client = new S3Client({
      region,
      credentials:
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
          ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }
  return _client;
}

function getBucket() {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new Error('AWS_S3_BUCKET is not configured.');
  return bucket;
}

/** Build a public HTTPS URL to the app asset proxy (for on-chain storage). */
export function buildAssetProxyUrl(key, origin) {
  const path = buildAssetProxyPath(key);
  const base = (origin || process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
  return base ? `${base}${path}` : path;
}

/**
 * Fetch an object from S3 (used by the public asset proxy).
 * @param {string} key
 */
export async function getObjectFromS3(key) {
  if (!isPublicAssetKey(key)) {
    throw new Error('Asset path not allowed');
  }

  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error('Empty object body');
  }

  return {
    body: response.Body,
    contentType: response.ContentType || 'application/octet-stream',
    cacheControl: response.CacheControl || 'public, max-age=31536000, immutable',
  };
}

const EXT_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

/**
 * Upload a buffer to S3 and return the proxy URL (no public bucket required).
 * @param {{ buffer: Buffer, contentType: string, folder?: string, fileName?: string, origin?: string }} opts
 */
export async function uploadToS3({ buffer, contentType, folder = 'uploads', fileName, origin }) {
  const bucket = getBucket();
  const ext = EXT_BY_TYPE[contentType] || 'bin';
  const safeName = (fileName || randomUUID()).replace(/[^\w.-]/g, '_');
  const key = `${folder.replace(/^\/|\/$/g, '')}/${Date.now()}-${safeName}.${ext}`;

  if (!isPublicAssetKey(key)) {
    throw new Error('Upload folder must be under party-symbols/ or candidates/.');
  }

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentDisposition: 'inline',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  return { key, url: buildAssetProxyUrl(key, origin) };
}

/** Derive request origin for absolute proxy URLs (upload responses, on-chain). */
export function getRequestOrigin(req) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  if (host) return `${proto}://${host}`;
  return (process.env.NEXTAUTH_URL || '').replace(/\/$/, '');
}
