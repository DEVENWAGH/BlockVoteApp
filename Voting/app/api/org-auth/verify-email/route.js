/**
 * POST /api/org-auth/verify-email — verify admin signup OTP.
 */
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db';
import Admin from '@/lib/models/Admin';
import EmailOTP from '@/lib/models/EmailOTP';

export async function POST(req) {
  try {
    const body = await req.json();
    const email = (body.email || body.adminEmail || '').toLowerCase().trim();
    const otp = body.otp;

    if (!email || !otp) {
      return NextResponse.json({ error: 'Email and OTP are required.' }, { status: 400 });
    }

    await connectDB();

    const record = await EmailOTP.findOne({
      email,
      purpose: 'admin-signup',
      used: false,
    });

    if (!record) {
      return NextResponse.json({ error: 'OTP not found or already used.' }, { status: 400 });
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json({ error: 'OTP has expired. Please sign up again.' }, { status: 400 });
    }

    if (record.attempts >= 5) {
      return NextResponse.json({ error: 'Too many failed attempts. Please sign up again.' }, { status: 429 });
    }

    const valid = await bcrypt.compare(String(otp).trim(), record.otp);
    if (!valid) {
      await EmailOTP.findByIdAndUpdate(record._id, { $inc: { attempts: 1 } });
      const left = 5 - (record.attempts + 1);
      return NextResponse.json(
        { error: `Incorrect OTP. ${left} attempt${left !== 1 ? 's' : ''} remaining.` },
        { status: 400 }
      );
    }

    await EmailOTP.findByIdAndUpdate(record._id, { used: true });

    const admin = await Admin.findOneAndUpdate(
      { email },
      { isEmailVerified: true },
      { returnDocument: 'after' }
    );

    if (!admin) {
      return NextResponse.json({ error: 'Admin account not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      admin: { id: admin._id, name: admin.name, email: admin.email },
    });
  } catch (err) {
    console.error('[admin verify-email]', err);
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 500 });
  }
}
