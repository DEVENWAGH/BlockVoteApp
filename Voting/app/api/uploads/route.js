/**
 * POST /api/uploads
 * Upload party symbol or candidate images to AWS S3.
 * Body: multipart/form-data — file (required), folder (optional, default party-symbols)
 */
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { uploadToS3, getRequestOrigin } from '@/lib/s3';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

const EXT_TO_TYPE = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

function resolveContentType(file) {
  if (file.type && ALLOWED.includes(file.type)) return file.type;
  const ext = file.name?.split('.').pop()?.toLowerCase();
  return ext ? EXT_TO_TYPE[ext] : null;
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const folder = (formData.get('folder') || 'party-symbols').toString();

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    const contentType = resolveContentType(file);
    if (!contentType) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, WebP, GIF, or SVG images are allowed.' },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be under 5 MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const origin = getRequestOrigin(req);
    const { url, key } = await uploadToS3({
      buffer,
      contentType,
      folder,
      fileName: file.name?.replace(/\.[^.]+$/, '') || 'upload',
      origin,
    });

    return NextResponse.json({ success: true, url, key });
  } catch (err) {
    console.error('[uploads]', err);
    const notConfigured =
      err.message?.includes('not configured') || err.message?.includes('AWS_');
    return NextResponse.json(
      {
        error: notConfigured
          ? 'Image upload is not available. Contact your administrator.'
          : 'Upload failed. Please try again.',
      },
      { status: notConfigured ? 503 : 500 },
    );
  }
}
