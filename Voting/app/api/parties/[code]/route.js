/**
 * PATCH  /api/parties/[code] { name?, symbol?, color?, allowMultiplePerSeat? } — admin
 * DELETE /api/parties/[code] — admin; refused while any candidate uses the party
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Party from '@/lib/models/Party';
import Candidate from '@/lib/models/Candidate';
import { auth } from '@/auth';
import { isAllowedAssetUrl, resolveAssetUrl } from '@/lib/urlUtils';
import { getRequestOrigin } from '@/lib/s3';
import { normalizeCode } from '@/lib/seats';

import { getAdminOrGuardian } from '@/lib/adminSession';

export async function PATCH(req, { params }) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { code } = await params;
    const body = await req.json();

    await connectDB();
    const party = await Party.findOne({ code: normalizeCode(code) });
    if (!party) return NextResponse.json({ error: 'Party not found' }, { status: 404 });

    const origin = getRequestOrigin(req);
    if (body.name !== undefined) {
      const n = String(body.name || '').trim();
      if (!n) return NextResponse.json({ error: 'Party name is required.' }, { status: 400 });
      party.name = n;
    }
    if (body.symbol !== undefined) {
      if (!isAllowedAssetUrl(body.symbol)) {
        return NextResponse.json({ error: 'Upload a valid symbol image.' }, { status: 400 });
      }
      party.symbol = resolveAssetUrl(String(body.symbol).trim(), origin);
    }
    if (body.manifesto !== undefined) party.manifesto = String(body.manifesto || '').trim();
    if (body.allowMultiplePerSeat !== undefined) party.allowMultiplePerSeat = Boolean(body.allowMultiplePerSeat);
    await party.save();

    // Keep the stored copy on candidates in sync so results screens match.
    await Candidate.updateMany({ partyCode: party.code }, { $set: { party: party.name, symbol: party.symbol } });

    return NextResponse.json({ success: true, party });
  } catch (err) {
    console.error('[parties PATCH]', err);
    return NextResponse.json({ error: err.message || 'Failed to update party' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { code } = await params;
    await connectDB();
    const party = await Party.findOne({ code: normalizeCode(code) }).lean();
    if (!party) return NextResponse.json({ error: 'Party not found' }, { status: 404 });

    const inUse = await Candidate.countDocuments({ partyCode: party.code });
    if (inUse > 0) {
      return NextResponse.json(
        { error: `${party.name} is used by ${inUse} candidate${inUse === 1 ? '' : 's'} and cannot be removed.` },
        { status: 409 },
      );
    }
    await Party.deleteOne({ _id: party._id });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[parties DELETE]', err);
    return NextResponse.json({ error: err.message || 'Failed to remove party' }, { status: 500 });
  }
}
