/**
 * POST /api/location/reverse
 * Converts device coordinates into coarse place labels only.
 * Coordinates are never persisted.
 */
import { NextResponse } from 'next/server';
import { reverseGeocode } from '@/lib/coarseLocation';

export async function POST(req) {
  try {
    const { lat, lng } = await req.json();
    const location = await reverseGeocode(lat, lng);

    if (!location) {
      return NextResponse.json(
        { error: 'Could not resolve a coarse location from coordinates.' },
        { status: 422 },
      );
    }

    return NextResponse.json({ success: true, location });
  } catch (err) {
    console.error('[location/reverse]', err);
    return NextResponse.json(
      { error: err.message || 'Reverse geocoding failed' },
      { status: 500 },
    );
  }
}
