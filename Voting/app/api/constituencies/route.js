/**
 * Shared seat list.
 * GET  /api/constituencies?level=&state=&district=&q=   — admin
 * POST /api/constituencies { code, name, level, state, district?, city?, village?, ward?, parentCode? } — admin
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Constituency, { SEAT_LEVELS } from '@/lib/models/Constituency';
import { auth } from '@/auth';
import { normalizeCode } from '@/lib/seats';

import mongoose from 'mongoose';
import { getAdminOrGuardian } from '@/lib/adminSession';

export async function GET(req) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await connectDB();
    const { searchParams } = new URL(req.url);
    const filter = {};
    const level = searchParams.get('level');
    const state = searchParams.get('state');
    const district = searchParams.get('district');
    const q = (searchParams.get('q') || '').trim();
    if (level && SEAT_LEVELS.includes(level)) filter.level = level;
    if (state) filter.state = new RegExp(`^${state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (district) filter.district = new RegExp(`^${district.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ code: rx }, { name: rx }, { city: rx }, { village: rx }];
    }
    const limit = Math.min(2000, Math.max(1, parseInt(searchParams.get('limit') || '500', 10)));
    const [seats, total, states] = await Promise.all([
      Constituency.find(filter).sort({ level: 1, state: 1, district: 1, name: 1 }).limit(limit).lean(),
      Constituency.countDocuments(filter),
      Constituency.distinct('state'),
    ]);
    return NextResponse.json({ seats, total, states: states.sort() });
  } catch (err) {
    console.error('[constituencies GET]', err);
    return NextResponse.json({ error: 'Failed to load seats' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    const code = normalizeCode(body.code);
    const name = String(body.name || '').trim();
    const level = String(body.level || '').trim();
    const state = String(body.state || '').trim();

    if (!code || !/^[A-Z0-9-]{2,24}$/.test(code)) {
      return NextResponse.json({ error: 'Seat code should be 2–24 letters, digits or dashes (e.g. MH-AC-258).' }, { status: 400 });
    }
    if (!name) return NextResponse.json({ error: 'Seat name is required.' }, { status: 400 });
    if (!SEAT_LEVELS.includes(level)) {
      return NextResponse.json({ error: `Level must be one of: ${SEAT_LEVELS.join(', ')}.` }, { status: 400 });
    }
    if (!state) return NextResponse.json({ error: 'State is required.' }, { status: 400 });
    if (level === 'municipal' && !String(body.city || '').trim()) {
      return NextResponse.json({ error: 'A municipal seat needs a city.' }, { status: 400 });
    }
    if (level === 'panchayat' && !String(body.village || '').trim()) {
      return NextResponse.json({ error: 'A panchayat seat needs a village.' }, { status: 400 });
    }

    await connectDB();
    if (await Constituency.findOne({ code }).lean()) {
      return NextResponse.json({ error: `Seat ${code} already exists.` }, { status: 409 });
    }
    const validAdminObjectId = (authResult.adminId && mongoose.Types.ObjectId.isValid(authResult.adminId))
      ? authResult.adminId
      : null;
    const seat = await Constituency.create({
      code,
      name,
      level,
      state,
      district: String(body.district || '').trim(),
      city: String(body.city || '').trim(),
      village: String(body.village || '').trim(),
      ward: String(body.ward || '').trim(),
      parentCode: normalizeCode(body.parentCode || ''),
      createdBy: validAdminObjectId,
    });
    return NextResponse.json({ success: true, seat }, { status: 201 });
  } catch (err) {
    console.error('[constituencies POST]', err);
    return NextResponse.json({ error: err.message || 'Failed to add seat' }, { status: 500 });
  }
}
