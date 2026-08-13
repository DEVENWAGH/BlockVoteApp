/**
 * POST /api/biometric/verify
 *
 * Liveness / human-face gate for mobile voting.
 * Does NOT require a previously enrolled face profile.
 *
 * Checks:
 *  - Exactly one face in frame
 *  - High confidence human face
 *  - Reasonable lighting
 *  - No eyeglasses / sunglasses
 *  - Eyes open (basic live-person signal)
 *
 * On success: issues a short-lived biometric JWT used by verify-otp.
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import BiometricHash from '@/lib/models/BiometricHash';
import { issueBiometricToken, getRekognitionClient } from '@/lib/biometric';
import { DetectFacesCommand } from '@aws-sdk/client-rekognition';
import { rateLimit } from '@/lib/rateLimit';

const biometricLimiter = rateLimit({
  windowMs: 120_000,
  max: 10,
  keyPrefix: 'biometric-verify',
  message: 'Too many verification attempts. Please wait before trying again.',
});

export async function POST(req) {
  const limited = biometricLimiter(req);
  if (limited) return limited;

  try {
    const { nullifierHash, image, electionId } = await req.json();

    if (!nullifierHash) {
      return NextResponse.json(
        { error: 'nullifierHash is required.' },
        { status: 400 },
      );
    }

    if (!image) {
      return NextResponse.json(
        { error: 'Image (base64 data URL) is required for biometric scan.' },
        { status: 400 },
      );
    }

    await connectDB();

    const rekognition = getRekognitionClient();
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const liveBuffer = Buffer.from(base64Data, 'base64');

    // ── Detect face(s) ──────────────────────────────────────────────────────
    const detectRes = await rekognition.send(
      new DetectFacesCommand({
        Image: { Bytes: liveBuffer },
        Attributes: ['ALL'],
      }),
    );

    const faces = detectRes.FaceDetails || [];

    if (faces.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No human face detected. Center your face in the frame and try again.',
        },
        { status: 400 },
      );
    }

    if (faces.length > 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Multiple faces detected. Only one person should be in the frame.',
        },
        { status: 400 },
      );
    }

    const face = faces[0];

    if ((face.Confidence || 0) < 90) {
      return NextResponse.json(
        {
          success: false,
          error: `Face confidence too low (${Math.round(face.Confidence || 0)}%). Move closer and use better lighting.`,
        },
        { status: 400 },
      );
    }

    if (face.Quality && face.Quality.Brightness < 30) {
      return NextResponse.json(
        {
          success: false,
          error: 'Lighting is too dark. Turn on lights or move to a brighter area.',
        },
        { status: 400 },
      );
    }

    const wearsGlasses =
      (face.Eyeglasses?.Value === true && (face.Eyeglasses?.Confidence || 0) > 80) ||
      (face.Sunglasses?.Value === true && (face.Sunglasses?.Confidence || 0) > 80);

    if (wearsGlasses) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please remove glasses or sunglasses, then try again.',
        },
        { status: 400 },
      );
    }

    // Basic live-person signal: eyes should be open
    if (face.EyesOpen?.Value === false && (face.EyesOpen?.Confidence || 0) > 80) {
      return NextResponse.json(
        {
          success: false,
          error: 'Eyes appear closed. Open your eyes and look at the camera.',
        },
        { status: 400 },
      );
    }

    const faceAttributes = {
      faceConfidence: face.Confidence,
      gender: face.Gender?.Value,
      genderConfidence: face.Gender?.Confidence,
      ageRange: face.AgeRange
        ? `${face.AgeRange.Low} - ${face.AgeRange.High} years old`
        : 'Unknown',
      brightness: face.Quality?.Brightness,
      sharpness: face.Quality?.Sharpness,
      eyesOpen: face.EyesOpen?.Value,
      eyeglasses: face.Eyeglasses?.Value,
      sunglasses: face.Sunglasses?.Value,
    };

    // Soft audit record only — no prior enrollment required
    try {
      await BiometricHash.findOneAndUpdate(
        { nullifierHash },
        {
          $set: {
            lastVerifiedAt: new Date(),
            faceAttributes,
            provider: 'aws-rekognition',
            electionId: electionId ? String(electionId) : '',
          },
          $setOnInsert: {
            nullifierHash,
            biometricHash: `liveness-only-${Date.now()}`,
            faceConfidence: face.Confidence || 0,
            twinVerificationStatus: 'none',
            registeredAt: new Date(),
            verificationCount: 0,
          },
          $inc: { verificationCount: 1 },
        },
        { upsert: true },
      );
    } catch (auditErr) {
      console.warn('[biometric/verify] audit upsert skipped:', auditErr.message);
    }

    const token = issueBiometricToken(nullifierHash);

    return NextResponse.json({
      success: true,
      message: 'Liveness check passed.',
      token,
      faceAttributes,
    });
  } catch (err) {
    console.error('[biometric/verify] Error:', err);

    // Helpful message when AWS is misconfigured / unreachable
    const msg = err?.message || 'Biometric verification failed.';
    if (/credentials|UnrecognizedClient|InvalidClientTokenId|ExpiredToken/i.test(msg)) {
      return NextResponse.json(
        { error: 'Face service is not configured. Check AWS Rekognition credentials.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
