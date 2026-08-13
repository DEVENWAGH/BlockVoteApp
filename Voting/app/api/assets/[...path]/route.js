/**
 * GET /api/assets/party-symbols/... | /api/assets/candidates/...
 * Public read proxy for ballot images — uses IAM credentials, no public S3 bucket needed.
 */
import { NextResponse } from 'next/server';
import { getObjectFromS3 } from '@/lib/s3';
import { isPublicAssetKey } from '@/lib/urlUtils';

export async function GET(_req, { params }) {
  try {
    const { path: segments } = await params;
    const parts = Array.isArray(segments) ? segments : [segments].filter(Boolean);

    if (!parts.length || parts.some((p) => p === '..' || p === '.')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const key = parts.map((segment) => decodeURIComponent(segment)).join('/');

    if (!isPublicAssetKey(key)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { body, contentType, cacheControl } = await getObjectFromS3(key);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (err.message === 'Asset path not allowed') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[assets GET]', err);
    return NextResponse.json({ error: 'Failed to load asset' }, { status: 500 });
  }
}
