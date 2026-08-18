import { NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/db';
import Admin from '@/lib/models/Admin';
import PasswordReset from '@/lib/models/PasswordReset';
import { sendPasswordResetEmail } from '@/lib/mailer';

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    await connectDB();
    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });

    if (!admin || !admin.passwordHash) {
      console.log('[forgot-password] No admin found or no password set for:', email);
      return NextResponse.json({ ok: true });
    }

    console.log('[forgot-password] Admin found:', admin.email);

    const recent = await PasswordReset.findOne({
      email: admin.email,
      used: false,
      expiresAt: { $gt: new Date() },
      createdAt: { $gt: new Date(Date.now() - 2 * 60 * 1000) },
    });
    if (recent) {
      console.log('[forgot-password] Rate-limited — recent reset exists');
      return NextResponse.json({ ok: true });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await PasswordReset.create({
      email: admin.email,
      token,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    await sendPasswordResetEmail(admin.email, { resetUrl });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[forgot-password]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
