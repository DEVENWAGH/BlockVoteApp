import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Organization verification removed.' },
    { status: 410 },
  );
}
