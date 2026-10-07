/**
 * GET /api/voters/list?electionId=...&status=all|pending|registered|rejected&page=&limit=&q=
 * People enrolled in one election, joined with their master-roll row.
 * Each row also shows the booth the vote was cast at versus the home seat.
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Enrollment from '@/lib/models/Enrollment';
import Voter from '@/lib/models/Voter';
import Constituency from '@/lib/models/Constituency';
import { auth } from '@/auth';
import { normalizeVoterId } from '@/lib/voterIdentity';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session?.user?.adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const electionIdRaw = searchParams.get('electionId');
    const status     = searchParams.get('status') || 'all';
    const q          = (searchParams.get('q') || '').trim();
    const seatCode   = (searchParams.get('constituencyCode') || '').trim().toUpperCase();
    const page       = Math.max(1, parseInt(searchParams.get('page')  || '1', 10));
    const limit      = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '100', 10)));

    if (electionIdRaw == null || electionIdRaw === '') {
      return NextResponse.json({ error: 'electionId is required' }, { status: 400 });
    }
    const electionId = String(electionIdRaw).trim();

    await connectDB();

    const baseFilter = { electionId };
    const filter = { ...baseFilter };
    if (status !== 'all') filter.status = status;
    if (seatCode) filter.constituencyCode = seatCode;

    if (q) {
      const idMatch = normalizeVoterId(q);
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const people = await Voter.find(
        { $or: [{ voterId: idMatch }, { name: rx }, { email: rx }] },
        { voterId: 1 },
      ).limit(500).lean();
      filter.voterId = { $in: people.map((p) => p.voterId) };
    }

    const [enrollments, total] = await Promise.all([
      Enrollment.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Enrollment.countDocuments(filter),
    ]);

    const voterIds = enrollments.map((e) => e.voterId);
    const [people, seats] = await Promise.all([
      Voter.find({ voterId: { $in: voterIds } })
        .select('voterId name email phone gender age state district city village ward homePollingStation assemblyConstituency parliamentaryConstituency')
        .lean(),
      Constituency.find({ code: { $in: [...new Set(enrollments.map((e) => e.constituencyCode).filter(Boolean))] } })
        .select('code name level')
        .lean(),
    ]);
    const personById = new Map(people.map((p) => [p.voterId, p]));
    const seatByCode = new Map(seats.map((s) => [s.code, s]));

    const voters = enrollments.map((e) => {
      const p = personById.get(e.voterId) || {};
      const seat = seatByCode.get(e.constituencyCode);
      return {
        _id: e._id,
        voterId: e.voterId,
        name: p.name || '',
        email: p.email || '',
        phone: p.phone || '',
        gender: p.gender || '',
        age: p.age ?? null,
        homePlace: [p.village || p.city, p.district, p.state].filter(Boolean).join(', '),
        homePollingStation: p.homePollingStation || '',
        constituencyCode: e.constituencyCode || '',
        constituencyName: seat?.name || '',
        status: e.status,
        registeredAt: e.registeredAt,
        onChainTxHash: e.onChainTxHash,
        rejectionReason: e.rejectionReason,
        inviteSentAt: e.inviteSentAt,
        votesCast: e.votesCast || 0,
        stationVoteFinal: e.stationVoteFinal === true,
        votedAt: e.votedAt,
        votedVia: e.votedVia || '',
        votedAtBoothName: e.votedAtBoothName || '',
        votedAtBoothCode: e.votedAtBoothCode || '',
        createdAt: e.createdAt,
      };
    });

    const [pending, registered, rejected] = await Promise.all([
      Enrollment.countDocuments({ ...baseFilter, status: 'pending' }),
      Enrollment.countDocuments({ ...baseFilter, status: 'registered' }),
      Enrollment.countDocuments({ ...baseFilter, status: 'rejected' }),
    ]);

    return NextResponse.json({
      voters,
      total,
      page,
      pages: Math.ceil(total / limit),
      counts: { pending, registered, rejected, total: pending + registered + rejected },
    });
  } catch (err) {
    console.error('[voters/list]', err);
    return NextResponse.json({ error: 'Failed to fetch voters' }, { status: 500 });
  }
}
