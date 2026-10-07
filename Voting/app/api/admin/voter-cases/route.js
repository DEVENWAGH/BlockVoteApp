/**
 * Guardian review of voter cases.
 *
 * GET  /api/admin/voter-cases?status=open|resolved&kind=missing|duplicate&page=&limit=
 *      Each case carries the new row, the existing person (for duplicates) and
 *      the list of fields that differ, so the guardian can compare side by side.
 *
 * POST /api/admin/voter-cases
 *      { caseId, action: 'keep_existing' | 'use_new' | 'send_back', note?, issuedAt, signature }
 *      The guardian wallet signs guardianActionMessage({ action: 'voter-case:<action>', target: caseId }).
 *      - keep_existing: the roll stays as it is (duplicates only)
 *      - use_new:       the existing master row is updated with the new details (duplicates only)
 *      - send_back:     nothing changes; the row is returned to staff
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import VoterCase from '@/lib/models/VoterCase';
import Voter from '@/lib/models/Voter';
import { verifyGuardianAction } from '@/lib/guardianAuth';
import { diffRows, COMPARE_FIELDS, FIELD_LABELS } from '@/lib/rollValidation';

const ACTIONS = ['keep_existing', 'use_new', 'send_back'];

export async function GET(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') === 'resolved' ? 'resolved' : 'open';
    const kind = searchParams.get('kind');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const filter = { status };
    if (kind === 'missing' || kind === 'duplicate') filter.kind = kind;

    const [cases, total, openMissing, openDuplicate] = await Promise.all([
      VoterCase.find(filter).sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      VoterCase.countDocuments(filter),
      VoterCase.countDocuments({ status: 'open', kind: 'missing' }),
      VoterCase.countDocuments({ status: 'open', kind: 'duplicate' }),
    ]);

    // Refresh the "existing" side from the live roll so the comparison is current.
    const existingIds = [...new Set(cases.map((c) => c.existingVoterId).filter(Boolean))];
    const people = existingIds.length ? await Voter.find({ voterId: { $in: existingIds } }).lean() : [];
    const byId = new Map(people.map((p) => [p.voterId, p]));

    const enriched = cases.map((c) => {
      const existing = byId.get(c.existingVoterId) || c.existingSnapshot || null;
      const differences = existing ? diffRows(c.newRow || {}, existing) : [];
      return {
        id: c._id,
        kind: c.kind,
        status: c.status,
        reasons: c.reasons,
        matchedOn: c.matchedOn,
        newRow: c.newRow,
        existing: existing ? Object.fromEntries(['voterId', ...COMPARE_FIELDS].map((f) => [f, existing[f] ?? ''])) : null,
        differences,
        fieldLabels: FIELD_LABELS,
        sourceFile: c.sourceFile,
        rowNumber: c.rowNumber,
        createdAt: c.createdAt,
        resolution: c.resolution,
        resolvedBy: c.resolvedBy,
        resolvedAt: c.resolvedAt,
        resolutionNote: c.resolutionNote,
      };
    });

    return NextResponse.json({
      cases: enriched,
      total,
      page,
      pages: Math.ceil(total / limit),
      counts: { openMissing, openDuplicate, open: openMissing + openDuplicate },
    });
  } catch (err) {
    console.error('[admin/voter-cases GET]', err);
    return NextResponse.json({ error: 'Failed to load voter cases' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { caseId, action, note = '', issuedAt, signature } = await req.json();
    if (!caseId) return NextResponse.json({ error: 'caseId is required' }, { status: 400 });
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: `action must be one of ${ACTIONS.join(', ')}` }, { status: 400 });
    }

    const guardian = await verifyGuardianAction({
      action: `voter-case:${action}`,
      target: String(caseId),
      issuedAt,
      signature,
    });
    if (!guardian.ok) return NextResponse.json({ error: guardian.error }, { status: 403 });

    await connectDB();
    const voterCase = await VoterCase.findById(caseId);
    if (!voterCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    if (voterCase.status !== 'open') {
      return NextResponse.json({ error: 'This case has already been decided.' }, { status: 409 });
    }

    if (voterCase.kind === 'missing' && action !== 'send_back') {
      return NextResponse.json(
        { error: 'A row with missing details can only be sent back for correction.' },
        { status: 400 },
      );
    }

    let applied = null;
    if (action === 'use_new') {
      if (!voterCase.existingVoterId) {
        return NextResponse.json({ error: 'No existing voter to update for this case.' }, { status: 400 });
      }
      const existing = await Voter.findOne({ voterId: voterCase.existingVoterId });
      if (!existing) {
        return NextResponse.json({ error: 'The existing voter is no longer on the roll.' }, { status: 404 });
      }
      const newRow = voterCase.newRow || {};
      // Guard: the new email must not belong to a third person.
      if (newRow.email && newRow.email !== existing.email) {
        const other = await Voter.findOne({ email: newRow.email, voterId: { $ne: existing.voterId } }).lean();
        if (other) {
          return NextResponse.json(
            { error: `The new email is already used by voter ID ${other.voterId}. Keep the existing details or send this row back.` },
            { status: 409 },
          );
        }
      }
      const changed = [];
      for (const field of COMPARE_FIELDS) {
        const incoming = newRow[field];
        if (incoming === '' || incoming === null || incoming === undefined) continue;
        if (String(existing[field] ?? '') !== String(incoming)) {
          existing[field] = incoming;
          changed.push(field);
        }
      }
      existing.lastImportedAt = new Date();
      await existing.save();
      applied = { voterId: existing.voterId, changed };
    }

    voterCase.status = 'resolved';
    voterCase.resolution = action === 'send_back' ? 'sent_back' : action;
    voterCase.resolvedBy = guardian.address;
    voterCase.resolvedAt = new Date();
    voterCase.resolutionNote = String(note || '').trim().slice(0, 500);
    await voterCase.save();

    const messages = {
      keep_existing: 'Kept the existing voter. The new row was not applied.',
      use_new: applied?.changed?.length
        ? `Updated ${applied.changed.map((f) => FIELD_LABELS[f] || f).join(', ')} for voter ID ${applied.voterId}.`
        : 'No fields needed changing.',
      send_back: 'Sent back to staff for correction.',
    };

    return NextResponse.json({ success: true, message: messages[action], applied, resolvedBy: guardian.address });
  } catch (err) {
    console.error('[admin/voter-cases POST]', err);
    return NextResponse.json({ error: err.message || 'Could not decide this case' }, { status: 500 });
  }
}
