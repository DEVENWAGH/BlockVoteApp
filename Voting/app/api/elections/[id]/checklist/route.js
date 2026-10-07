/**
 * GET /api/elections/[id]/checklist — "Ready to open voting?" items.
 * Readable by the election admin (dashboard) and by anyone on the guardian
 * portal (the portal is wallet-gated client side; nothing here is secret).
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import { electionChecklist } from '@/lib/checklist';

export async function GET(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;
    const election = await Election.findOne({ electionId: String(id) }).lean();
    if (!election) return NextResponse.json({ error: 'Election not found' }, { status: 404 });
    const checklist = await electionChecklist(election);
    return NextResponse.json({ success: true, electionId: election.electionId, level: election.level || 'general', ...checklist });
  } catch (err) {
    console.error('[checklist GET]', err);
    return NextResponse.json({ error: 'Failed to build checklist' }, { status: 500 });
  }
}
