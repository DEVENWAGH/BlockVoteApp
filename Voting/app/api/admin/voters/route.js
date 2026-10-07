import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';
import VoterCase from '@/lib/models/VoterCase';
import Enrollment from '@/lib/models/Enrollment';
import Constituency from '@/lib/models/Constituency';
import { normalizeVoterId } from '@/lib/voterIdentity';

/**
 * GET /api/admin/voters
 * Allows Guardians and Admins to inspect and verify the master electoral roll,
 * search by ID/name/email/phone, and verify geographic/seat assignments.
 */
export async function GET(req) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const state = (searchParams.get('state') || '').trim();
    const constituency = (searchParams.get('constituency') || '').trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const filter = {};
    if (state) filter.state = state;
    if (constituency) {
      filter.$or = [
        { assemblyConstituency: constituency.toUpperCase() },
        { parliamentaryConstituency: constituency.toUpperCase() },
      ];
    }

    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const textConditions = [
        { voterId: normalizeVoterId(q) },
        { name: rx },
        { email: rx },
      ];
      const digitsOnly = q.replace(/\D/g, '');
      if (digitsOnly.length >= 3) {
        textConditions.push({ phone: new RegExp(digitsOnly, 'i') });
      }
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: textConditions }];
        delete filter.$or;
      } else {
        filter.$or = textConditions;
      }
    }

    const [voters, total, states, openCasesCount, totalVoters] = await Promise.all([
      Voter.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Voter.countDocuments(filter),
      Voter.distinct('state'),
      VoterCase.countDocuments({ status: 'open' }),
      Voter.countDocuments({}),
    ]);

    const voterIds = voters.map((v) => v.voterId);

    // Cross-check open cases for these voters
    const openCases = voterIds.length
      ? await VoterCase.find(
          {
            status: 'open',
            $or: [{ 'newRow.voterId': { $in: voterIds } }, { existingVoterId: { $in: voterIds } }],
          },
          { 'newRow.voterId': 1, existingVoterId: 1, kind: 1 }
        ).lean()
      : [];

    const caseMap = new Map();
    for (const c of openCases) {
      if (c.newRow?.voterId) caseMap.set(c.newRow.voterId, c.kind);
      if (c.existingVoterId) caseMap.set(c.existingVoterId, c.kind);
    }

    // Cross-check election enrollment counts
    const enrollments = voterIds.length
      ? await Enrollment.aggregate([
          { $match: { voterId: { $in: voterIds } } },
          { $group: { _id: '$voterId', count: { $sum: 1 } } },
        ])
      : [];
    const enrollMap = new Map(enrollments.map((e) => [e._id, e.count]));

    const formattedVoters = voters.map((v) => ({
      _id: String(v._id),
      voterId: v.voterId,
      name: v.name,
      email: v.email,
      phone: v.phone || '',
      gender: v.gender || '',
      age: v.age,
      state: v.state || '',
      district: v.district || '',
      city: v.city || '',
      village: v.village || '',
      ward: v.ward || '',
      partNo: v.partNo || '',
      homePollingStation: v.homePollingStation || '',
      assemblyConstituency: v.assemblyConstituency || '',
      parliamentaryConstituency: v.parliamentaryConstituency || '',
      source: v.source || 'csv',
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
      hasCase: caseMap.has(v.voterId),
      caseKind: caseMap.get(v.voterId) || null,
      enrollmentCount: enrollMap.get(v.voterId) || 0,
      isVerified: !caseMap.has(v.voterId),
    }));

    return NextResponse.json({
      voters: formattedVoters,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      stats: {
        totalVoters,
        verifiedVoters: totalVoters - openCasesCount,
        openCases: openCasesCount,
        statesCount: states.length,
      },
      states: states.filter(Boolean).sort(),
    });
  } catch (err) {
    console.error('Failed to get voters for verification:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch voters' }, { status: 500 });
  }
}
