import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db';
import Admin from '@/lib/models/Admin';
import PasswordReset from '@/lib/models/PasswordReset';

export async function POST(req) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    await connectDB();
    const reset = await PasswordReset.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!reset) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 });
    }

    const admin = await Admin.findOne({ email: reset.email });
    if (!admin) {
      return NextResponse.json({ error: 'Account not found' }, { status: 400 });
    }

    admin.passwordHash = await bcrypt.hash(password, 12);
    await admin.save();

    reset.used = true;
    await reset.save();

    // Invalidate all other pending resets for this email
    await PasswordReset.updateMany(
      { email: reset.email, used: false, _id: { $ne: reset._id } },
      { used: true },
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[reset-password]', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
