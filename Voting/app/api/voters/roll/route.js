/**
 * Master electoral roll (admin).
 * GET  /api/voters/roll?q=&state=&district=&city=&village=&constituencyCode=&page=&limit=
 * POST /api/voters/roll  { voterId, name, email, ... }   — add one person by hand
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';
import Constituency from '@/lib/models/Constituency';
import VoterCase from '@/lib/models/VoterCase';
import Enrollment from '@/lib/models/Enrollment';
import { auth } from '@/auth';
import { buildScopeFilter } from '@/lib/enrollment';
import { normalizeRollRow, classifyRow } from '@/lib/rollValidation';
import { normalizeVoterId } from '@/lib/voterIdentity';
import { getAdminOrGuardian } from '@/lib/adminSession';

export async function GET(req) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const filter = buildScopeFilter({
      state: searchParams.get('state'),
      district: searchParams.get('district'),
      city: searchParams.get('city'),
      village: searchParams.get('village'),
      constituencyCode: searchParams.get('constituencyCode'),
    });
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$and = [{ $or: [{ voterId: normalizeVoterId(q) }, { name: rx }, { email: rx }, { phone: q.replace(/\D/g, '') || '—' }] }];
    }

    const [voters, total, states, openCases] = await Promise.all([
      Voter.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Voter.countDocuments(filter),
      Voter.distinct('state'),
      VoterCase.countDocuments({ status: 'open' }),
    ]);

    const ids = voters.map((v) => v.voterId);
    const [cases, enrollCounts] = await Promise.all([
      VoterCase.find({ status: 'open', $or: [{ 'newRow.voterId': { $in: ids } }, { existingVoterId: { $in: ids } }] }, { 'newRow.voterId': 1, existingVoterId: 1 }).lean(),
      Enrollment.aggregate([{ $match: { voterId: { $in: ids } } }, { $group: { _id: '$voterId', elections: { $sum: 1 } } }]),
    ]);
    const caseIds = new Set();
    for (const c of cases) {
      if (c.newRow?.voterId) caseIds.add(c.newRow.voterId);
      if (c.existingVoterId) caseIds.add(c.existingVoterId);
    }
    const enrollById = new Map(enrollCounts.map((e) => [e._id, e.elections]));

    return NextResponse.json({
      voters: voters.map((v) => ({
        ...v,
        hasOpenCase: caseIds.has(v.voterId),
        elections: enrollById.get(v.voterId) || 0,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
      states: states.filter(Boolean).sort(),
      openCases,
    });
  } catch (err) {
    console.error('[voters/roll GET]', err);
    return NextResponse.json({ error: 'Failed to load the roll' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();

    const row = normalizeRollRow(await req.json());
    const seatCodes = new Set((await Constituency.find({}, { code: 1 }).lean()).map((s) => s.code));

    const [byId, byEmail, byPhone] = await Promise.all([
      row.voterId ? Voter.findOne({ voterId: row.voterId }).lean() : null,
      row.email ? Voter.findOne({ email: row.email }).lean() : null,
      row.phone ? Voter.find({ phone: row.phone }).lean() : [],
    ]);
    const ctx = {
      byVoterId: new Map(byId ? [[byId.voterId, byId]] : []),
      byEmail: new Map(byEmail ? [[byEmail.email, byEmail]] : []),
      byPhone: new Map(row.phone ? [[row.phone, byPhone]] : []),
      seenInFile: new Set(),
      seatCodes,
    };
    const result = classifyRow(row, ctx);

    if (result.action === 'missing') {
      return NextResponse.json({ error: result.reasons.join(' ') }, { status: 400 });
    }
    if (result.action === 'skip') {
      return NextResponse.json({ success: true, unchanged: true, voter: result.existing });
    }
    if (result.action === 'duplicate') {
      const voterCase = await VoterCase.create({
        kind: 'duplicate',
        reasons: result.reasons,
        matchedOn: result.matchedOn,
        newRow: row,
        existingVoterId: result.existing?.voterId || '',
        existingSnapshot: result.existing ? (({ _id, __v, ...rest }) => rest)(result.existing) : null,
        sourceFile: 'manual entry',
        createdBy: authResult.adminId,
      });
      return NextResponse.json(
        { success: true, caseOpened: true, caseId: voterCase._id, message: `${result.reasons.join(' ')} Sent to the guardians to decide.` },
        { status: 202 },
      );
    }

    const voter = await Voter.create({ ...row, source: 'manual', createdBy: authResult.adminId, lastImportedAt: new Date() });
    return NextResponse.json({ success: true, voter }, { status: 201 });
  } catch (err) {
    console.error('[voters/roll POST]', err);
    return NextResponse.json({ error: err.message || 'Could not add voter' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();

    const { searchParams } = new URL(req.url);
    const voterId = searchParams.get('voterId');

    let body = {};
    try {
      body = await req.json();
    } catch {
      // URL query fallback
    }

    const idsToDelete = [];
    if (voterId) {
      idsToDelete.push(voterId);
    } else if (Array.isArray(body.voterIds) && body.voterIds.length > 0) {
      idsToDelete.push(...body.voterIds);
    } else if (body.all === true) {
      const count = await Voter.countDocuments({});
      await Promise.all([
        Voter.deleteMany({}),
        VoterCase.deleteMany({}),
        Enrollment.deleteMany({}),
      ]);
      return NextResponse.json({ success: true, deletedCount: count, message: `Removed all ${count} voters from the roll.` });
    }

    if (!idsToDelete.length) {
      return NextResponse.json({ error: 'Specify voterId or voterIds to remove' }, { status: 400 });
    }

    const res = await Voter.deleteMany({ voterId: { $in: idsToDelete } });
    await Promise.all([
      VoterCase.deleteMany({ $or: [{ 'newRow.voterId': { $in: idsToDelete } }, { existingVoterId: { $in: idsToDelete } }] }),
      Enrollment.deleteMany({ voterId: { $in: idsToDelete } }),
    ]);

    return NextResponse.json({
      success: true,
      deletedCount: res.deletedCount,
      message: `Removed ${res.deletedCount} voter(s) from the roll.`,
    });
  } catch (err) {
    console.error('[voters/roll DELETE]', err);
    return NextResponse.json({ error: err.message || 'Could not delete voter(s)' }, { status: 500 });
  }
}
