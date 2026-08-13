import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Organization admin APIs removed. Use /api/admin/managed-elections.' },
    { status: 410 },
  );
}
