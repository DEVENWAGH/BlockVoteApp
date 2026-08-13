/**
 * POST /api/org-auth/signup — admin signup (organization concept removed).
 * Accepts legacy body fields (orgName → name, adminEmail → email).
 */
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db';
import Admin from '@/lib/models/Admin';
import EmailOTP from '@/lib/models/EmailOTP';
import { sendOTPEmail } from '@/lib/mailer';

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req) {
  try {
    const body = await req.json();
    const name = (body.name || body.orgName || '').trim();
    const email = (body.email || body.adminEmail || '').toLowerCase().trim();
    const password = body.password;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'name, email, and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    await connectDB();

    const existing = await Admin.findOne({ email });
    if (existing?.isEmailVerified) {
      return NextResponse.json(
        { error: 'An admin account with this email already exists.' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await Admin.findOneAndUpdate(
      { email },
      {
        name,
        email,
        passwordHash,
        isEmailVerified: false,
        isActive: true,
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 8);
    await EmailOTP.findOneAndUpdate(
      { email, purpose: 'admin-signup' },
      {
        email,
        otp: otpHash,
        purpose: 'admin-signup',
        electionId: '',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        used: false,
        attempts: 0,
      },
      { upsert: true, returnDocument: 'after' }
    );

    await sendOTPEmail(email, otp, 'admin-signup', name);

    return NextResponse.json(
      { success: true, message: 'OTP sent to your email. Please verify.' },
      { status: 201 }
    );
  } catch (err) {
    if (err.code === 11000) {
      return NextResponse.json(
        { error: 'An admin with this email already exists.' },
        { status: 409 }
      );
    }
    console.error('[admin-signup]', err);
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }
}
