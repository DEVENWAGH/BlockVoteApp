/**
 * Organization registry removed. Returns 410 Gone.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Organizations removed. Use election invite links (/go/{electionId}).' },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'Organizations removed. Sign up as an admin at /signup.' },
    { status: 410 },
  );
}
