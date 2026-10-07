import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Voter from '@/lib/models/Voter';
import Enrollment from '@/lib/models/Enrollment';
import { getStationSession } from '@/lib/stationSession';

/**
 * GET /api/station/voters
 * Returns registered voters assigned to the active polling station area.
 * Cross-references voter registration and vote status for this election.
 */
export async function GET(req) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const station = await getStationSession();

    const electionId = searchParams.get('electionId') || station?.electionId || '';
    const stationName = searchParams.get('stationName') || station?.stationName || '';
    const district = searchParams.get('district') || station?.district || '';
    const state = searchParams.get('state') || station?.state || '';
    let ward = searchParams.get('ward') || station?.ward || '';
    const city = searchParams.get('city') || station?.city || '';
    const constituency = searchParams.get('constituency') || '';
    const q = (searchParams.get('q') || '').trim();

    // Auto-detect ward from stationName if not explicitly passed (e.g. "panvel-w7" or "Ward 7")
    if (!ward && stationName) {
      const match = stationName.match(/(?:ward|w)[-_\s]?([0-9]+)/i);
      if (match) ward = match[1];
    }

    // Strip bracketed descriptors from stationName (e.g. "MES Pillai College Hall (Ward 7, Panvel)" -> "MES Pillai College Hall")
    const cleanStationCore = stationName ? stationName.split('(')[0].replace(/[-_]+/g, ' ').trim() : '';

    const filter = {};
    const conditions = [];

    if (ward) {
      if (city) {
        conditions.push({ ward: String(ward), city: new RegExp(`^${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      }
      if (constituency) {
        conditions.push({ ward: String(ward), assemblyConstituency: constituency.toUpperCase() });
        conditions.push({ ward: String(ward), parliamentaryConstituency: constituency.toUpperCase() });
      }
      if (district) {
        conditions.push({ ward: String(ward), district: new RegExp(`^${district.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
      }
      conditions.push({ ward: String(ward) });
    }

    if (cleanStationCore && cleanStationCore.length > 2) {
      conditions.push({
        homePollingStation: new RegExp(cleanStationCore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      });
    }

    if (constituency) {
      conditions.push({ assemblyConstituency: constituency.toUpperCase() });
      conditions.push({ parliamentaryConstituency: constituency.toUpperCase() });
    }

    if (conditions.length > 0) {
      filter.$or = conditions;
    } else if (district) {
      filter.district = new RegExp(`^${district.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      if (state) filter.state = new RegExp(`^${state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }

    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const searchConditions = [
        { voterId: rx },
        { name: rx },
        { email: rx },
        { phone: rx },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    // Return voters matching this station area
    const voters = await Voter.find(filter).sort({ name: 1 }).limit(200).lean();

    const voterIds = voters.map((v) => v.voterId);

    // Cross-reference vote status from Enrollments
    const enrollments = electionId && voterIds.length
      ? await Enrollment.find({ electionId, voterId: { $in: voterIds } }).lean()
      : [];

    const enrollMap = new Map(enrollments.map((e) => [e.voterId, e]));

    let votedCount = 0;
    const formattedVoters = voters.map((v) => {
      const enroll = enrollMap.get(v.voterId);
      const hasVoted = Boolean(enroll?.votesCast && enroll.votesCast > 0);
      if (hasVoted) votedCount++;

      return {
        _id: String(v._id),
        voterId: v.voterId,
        name: v.name,
        email: v.email,
        phone: v.phone || '',
        gender: v.gender || '',
        age: v.age,
        state: v.state,
        district: v.district,
        city: v.city,
        ward: v.ward,
        homePollingStation: v.homePollingStation || '',
        assemblyConstituency: v.assemblyConstituency || '',
        parliamentaryConstituency: v.parliamentaryConstituency || '',
        isEnrolled: Boolean(enroll),
        hasVoted,
        votesCast: enroll?.votesCast || 0,
        votedAt: enroll?.votedAt || null,
        votedVia: enroll?.votedVia || '',
      };
    });

    return NextResponse.json({
      voters: formattedVoters,
      total: formattedVoters.length,
      votedCount,
      pendingCount: formattedVoters.length - votedCount,
      stationContext: {
        stationName,
        district,
        state,
        electionId,
      },
    });
  } catch (err) {
    console.error('Failed to get station voters:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch station voters' }, { status: 500 });
  }
}
