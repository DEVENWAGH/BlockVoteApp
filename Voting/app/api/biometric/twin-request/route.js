import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import BiometricHash from '@/lib/models/BiometricHash';
import Enrollment from '@/lib/models/Enrollment';

export async function POST(req) {
  try {
    const { electionId, nullifierHash, notes } = await req.json();

    if (!nullifierHash) {
      return NextResponse.json({ error: 'nullifierHash is required.' }, { status: 400 });
    }

    await connectDB();

    // 1. Verify the enrollment exists (nullifiers are per election)
    const filter = { nullifierHash };
    if (electionId) filter.electionId = String(electionId);
    const enrollment = await Enrollment.findOne(filter).lean();
    if (!enrollment) {
      return NextResponse.json({ error: 'Voter not found.' }, { status: 404 });
    }

    const resolvedElectionId = electionId || enrollment.electionId || '';

    // 2. Fetch or create the biometric record and set twin status to pending
    let record = await BiometricHash.findOne({ nullifierHash });

    if (!record) {
      record = await BiometricHash.create({
        nullifierHash,
        biometricHash: 'pending-initial-twin-submission',
        faceConfidence: 0.9,
        provider: 'aws-rekognition',
        twinVerificationStatus: 'pending',
        twinNotes: notes?.trim() || 'User submitted twin verification request.',
        registeredAt: new Date(),
        electionId: resolvedElectionId,
      });
    } else {
      record.twinVerificationStatus = 'pending';
      if (notes?.trim()) {
        record.twinNotes = notes.trim();
      } else if (!record.twinNotes) {
        record.twinNotes = 'User requested twin verification override.';
      }
      if (!record.electionId && resolvedElectionId) record.electionId = resolvedElectionId;
      await record.save();
    }

    return NextResponse.json({
      success: true,
      message: 'Twin verification override requested successfully.',
      status: record.twinVerificationStatus,
    });
  } catch (err) {
    console.error('[biometric/twin-request] Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to submit twin request.' }, { status: 500 });
  }
}
