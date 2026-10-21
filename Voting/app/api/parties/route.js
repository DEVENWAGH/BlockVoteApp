/**
 * Shared party registry.
 * GET  /api/parties                 — list (public; the ballot needs symbols)
 * POST /api/parties { code, name, symbol, color?, allowMultiplePerSeat? }  — admin
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Party from '@/lib/models/Party';
import { auth } from '@/auth';
import { isAllowedAssetUrl, resolveAssetUrl } from '@/lib/urlUtils';
import { getRequestOrigin } from '@/lib/s3';
import { normalizeCode } from '@/lib/seats';
import { serializeParty } from '@/lib/ballot';

export async function GET(req) {
  try {
    await connectDB();
    const origin = getRequestOrigin(req);
    const parties = await Party.find({}).sort({ name: 1 }).lean();
    return NextResponse.json({ parties: parties.map((p) => serializeParty(p, origin)) });
  } catch (err) {
    console.error('[parties GET]', err);
    return NextResponse.json({ error: 'Failed to load parties' }, { status: 500 });
  }
}

import mongoose from 'mongoose';
import { getAdminOrGuardian } from '@/lib/adminSession';

export async function POST(req) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code, name, symbol, color = '', manifesto = '', allowMultiplePerSeat = false } = await req.json();
    const cleanCode = normalizeCode(code);
    const cleanName = String(name || '').trim();

    if (!cleanCode || !/^[A-Z0-9-]{1,12}$/.test(cleanCode)) {
      return NextResponse.json({ error: 'Party code should be 1–12 letters or digits (e.g. INC, BJP, IND).' }, { status: 400 });
    }
    if (!cleanName) {
      return NextResponse.json({ error: 'Party name is required.' }, { status: 400 });
    }
    if (!isAllowedAssetUrl(symbol)) {
      return NextResponse.json({ error: 'Upload the party symbol image.' }, { status: 400 });
    }

    await connectDB();
    const origin = getRequestOrigin(req);

    const exists = await Party.findOne({ code: cleanCode }).lean();
    if (exists) {
      return NextResponse.json({ error: `A party with code ${cleanCode} already exists.` }, { status: 409 });
    }

    const validAdminObjectId = (authResult.adminId && mongoose.Types.ObjectId.isValid(authResult.adminId))
      ? authResult.adminId
      : null;

    const party = await Party.create({
      code: cleanCode,
      name: cleanName,
      symbol: resolveAssetUrl(String(symbol).trim(), origin),
      color: String(color || '').trim().slice(0, 16),
      manifesto: String(manifesto || '').trim(),
      allowMultiplePerSeat: Boolean(allowMultiplePerSeat),
      createdBy: validAdminObjectId,
    });

    return NextResponse.json({ success: true, party: serializeParty(party.toObject(), origin) }, { status: 201 });
  } catch (err) {
    console.error('[parties POST]', err);
    return NextResponse.json({ error: err.message || 'Failed to add party' }, { status: 500 });
  }
}
