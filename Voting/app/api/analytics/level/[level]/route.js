import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Constituency from '@/lib/models/Constituency';
import Election from '@/lib/models/Election';
import Candidate from '@/lib/models/Candidate';
import Voter from '@/lib/models/Voter';
import Enrollment from '@/lib/models/Enrollment';
import VoteActivity from '@/lib/models/VoteActivity';

export const LEVEL_METADATA = {
  assembly: {
    key: 'assembly',
    title: 'Assembly (MLA)',
    subtitle: 'State Legislative Assembly (Vidhan Sabha)',
    role: 'Member of Legislative Assembly (MLA)',
    badge: 'MLA',
    tier: 'State Tier',
    description: 'Constituency-level legislative races representing states and union territories.',
    unitLabel: 'Constituency',
    unitPlural: 'Constituencies',
    color: '#0078D4',
  },
  loksabha: {
    key: 'loksabha',
    title: 'Lok Sabha (MP)',
    subtitle: 'Parliamentary Constituency (House of the People)',
    role: 'Member of Parliament (MP)',
    badge: 'MP',
    tier: 'National Tier',
    description: 'National parliamentary constituencies electing lawmakers to the Lok Sabha.',
    unitLabel: 'Parliamentary Seat',
    unitPlural: 'Parliamentary Seats',
    color: '#107C10',
  },
  municipal: {
    key: 'municipal',
    title: 'Municipal Ward',
    subtitle: 'Urban Local Body (Nagar Palika / Municipal Corporation)',
    role: 'Municipal Corporator / Councilor',
    badge: 'Municipal',
    tier: 'Urban Local Tier',
    description: 'Local urban wards managing municipal administration, town planning, and civic works.',
    unitLabel: 'Municipal Ward',
    unitPlural: 'Municipal Wards',
    color: '#8764B8',
  },
  panchayat: {
    key: 'panchayat',
    title: 'Panchayat Ward',
    subtitle: 'Rural Local Body (Gram Panchayat)',
    role: 'Gram Panchayat Member / Sarpanch',
    badge: 'Panchayat',
    tier: 'Rural Local Tier',
    description: 'Village council wards representing rural grassroots governance and development.',
    unitLabel: 'Panchayat Ward',
    unitPlural: 'Panchayat Wards',
    color: '#D83B01',
  },
};

export async function GET(request, { params }) {
  try {
    await connectDB();
    const { level: rawLevel } = await params;
    const levelKey = String(rawLevel || '').toLowerCase().trim();

    const meta = LEVEL_METADATA[levelKey];
    if (!meta && levelKey !== 'all') {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid level "${levelKey}". Supported levels: ${Object.keys(LEVEL_METADATA).join(', ')}.`,
        },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const electionIdParam = searchParams.get('electionId');

    // 1. Find Election
    let election = null;
    if (electionIdParam) {
      election = await Election.findOne({ electionId: String(electionIdParam) }).lean();
    }
    if (!election) {
      election = await Election.findOne({ phase: { $ne: 2 } }).sort({ createdAt: -1 }).lean()
        || await Election.findOne({}).sort({ createdAt: -1 }).lean();
    }

    // 2. Fetch Constituencies for this level
    const seatQuery = levelKey === 'all' ? {} : { level: levelKey };
    const seats = await Constituency.find(seatQuery).sort({ code: 1 }).lean();
    const seatCodes = seats.map((s) => s.code.toUpperCase());

    // 3. Aggregate Candidates
    const candQuery = { status: { $ne: 'rejected' } };
    if (election) candQuery.electionId = election.electionId;
    if (seatCodes.length > 0 && levelKey !== 'all') {
      candQuery.$or = [
        { constituencyCode: { $in: seatCodes } },
        { constituencyCode: { $exists: false } },
        { constituencyCode: '' },
      ];
    }
    const candidates = await Candidate.find(candQuery).sort({ voteCount: -1 }).lean();

    // Map candidates by seat code (assigning general ones to first seat of level)
    const candidatesBySeat = {};
    for (const c of candidates) {
      let code = (c.constituencyCode || '').toUpperCase();
      if (!code && seatCodes.length) {
        code = seatCodes[0];
      }
      if (!candidatesBySeat[code]) candidatesBySeat[code] = [];
      candidatesBySeat[code].push({ ...c, constituencyCode: code });
    }

    // 4. Aggregate Voters & Enrollments
    const voterMatch = [];
    if (levelKey === 'assembly') {
      voterMatch.push({ assemblyConstituency: { $in: seatCodes } });
    } else if (levelKey === 'loksabha') {
      voterMatch.push({ parliamentaryConstituency: { $in: seatCodes } });
    } else if (levelKey === 'municipal') {
      const wardNums = seats.map((s) => s.ward).filter(Boolean);
      voterMatch.push({ assemblyConstituency: { $in: seatCodes } });
      if (wardNums.length) voterMatch.push({ ward: { $in: wardNums } });
    } else if (levelKey === 'panchayat') {
      const wardNums = seats.map((s) => s.ward).filter(Boolean);
      voterMatch.push({ assemblyConstituency: { $in: seatCodes } });
      if (wardNums.length) voterMatch.push({ ward: { $in: wardNums } });
    } else {
      voterMatch.push({});
    }

    const voters = voterMatch.length ? await Voter.find({ $or: voterMatch }).lean() : [];

    // Map voters by seat code
    const votersBySeat = {};
    for (const v of voters) {
      let code = '';
      if (levelKey === 'assembly') code = (v.assemblyConstituency || '').toUpperCase();
      else if (levelKey === 'loksabha') code = (v.parliamentaryConstituency || '').toUpperCase();
      else code = (v.assemblyConstituency || '').toUpperCase();

      if (!code && seats.length) {
        // Fallback match by ward or city
        const match = seats.find((s) => (s.ward && s.ward === v.ward) || (s.city && s.city === v.city));
        if (match) code = match.code.toUpperCase();
      }

      if (code) {
        if (!votersBySeat[code]) votersBySeat[code] = [];
        votersBySeat[code].push(v);
      }
    }

    // 5. Aggregate Enrollments for votes cast & channel analysis
    const enrollQuery = {};
    if (election) enrollQuery.electionId = election.electionId;
    if (seatCodes.length && levelKey !== 'all') {
      enrollQuery.constituencyCode = { $in: seatCodes };
    }
    const enrollments = await Enrollment.find(enrollQuery).lean();

    const enrollmentsBySeat = {};
    let totalVotesCast = 0;
    let totalAppVotes = 0;
    let totalStationVotes = 0;
    let totalRemoteVotes = 0;

    for (const e of enrollments) {
      const code = (e.constituencyCode || '').toUpperCase();
      if (!enrollmentsBySeat[code]) enrollmentsBySeat[code] = [];
      enrollmentsBySeat[code].push(e);

      if ((e.votesCast || 0) > 0) {
        totalVotesCast += 1;
        if (e.stationVoteFinal || e.votedVia === 'station') {
          totalStationVotes += 1;
          // Remote check: if voted at a booth whose name or code differs from voter home station
          if (e.votedAtBoothName) {
            totalRemoteVotes += 1;
          }
        } else {
          totalAppVotes += 1;
        }
      }
    }

    // Also count voters with hasVoted flag if enrollments are still synchronizing
    for (const v of voters) {
      if (v.hasVoted && !enrollments.some((e) => e.voterId === v.voterId)) {
        totalVotesCast += 1;
        totalStationVotes += 1;
      }
    }

    // 6. Build Seat-by-Seat Breakdown
    const seatsAnalytics = seats.map((seat) => {
      const code = seat.code.toUpperCase();
      const seatVoters = votersBySeat[code] || [];
      const seatEnrollments = enrollmentsBySeat[code] || [];
      const seatCandidates = (candidatesBySeat[code] || []).map((c) => ({
        id: c.candidateId,
        name: c.name,
        party: c.party,
        partyCode: c.partyCode,
        symbol: c.symbol,
        voteCount: c.voteCount || 0,
      }));

      // Calculate total registered in this seat
      const registeredCount = Math.max(seatVoters.length, seatEnrollments.length, seatCandidates.length * 3);
      
      // Calculate votes in this seat
      let votedCount = seatEnrollments.filter((e) => (e.votesCast || 0) > 0).length;
      if (votedCount === 0) {
        votedCount = seatVoters.filter((v) => v.hasVoted).length;
      }
      // If candidates have votes, use sum of candidate votes as lower bound
      const sumCandidateVotes = seatCandidates.reduce((sum, c) => sum + (c.voteCount || 0), 0);
      if (sumCandidateVotes > votedCount) {
        votedCount = sumCandidateVotes;
      }

      const turnout = registeredCount > 0 ? Math.min(100, Number(((votedCount / registeredCount) * 100).toFixed(1))) : 0;

      // Identify leading candidate
      const sortedCandidates = [...seatCandidates].sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
      const leader = sortedCandidates[0] || null;

      return {
        code: seat.code,
        name: seat.name,
        level: seat.level,
        state: seat.state || 'Maharashtra',
        district: seat.district || '',
        city: seat.city || '',
        ward: seat.ward || '',
        registeredVoters: registeredCount,
        votesCast: votedCount,
        turnoutPercentage: turnout,
        candidatesCount: seatCandidates.length,
        candidates: sortedCandidates,
        leader: leader ? { name: leader.name, party: leader.party, voteCount: leader.voteCount } : null,
      };
    });

    // 7. Party performance in this tier
    const partyMap = {};
    for (const c of candidates) {
      const p = c.party || 'Independent';
      if (!partyMap[p]) {
        partyMap[p] = {
          name: p,
          partyCode: c.partyCode || '',
          symbol: c.symbol || '',
          votes: 0,
          seatsContested: 0,
          leadingSeats: 0,
        };
      }
      partyMap[p].votes += c.voteCount || 0;
      partyMap[p].seatsContested += 1;
    }

    // Check which seats each party leads
    for (const s of seatsAnalytics) {
      if (s.leader && partyMap[s.leader.party]) {
        partyMap[s.leader.party].leadingSeats += 1;
      }
    }

    const parties = Object.values(partyMap).sort((a, b) => b.votes - a.votes);

    // 8. Overall KPI calculations
    const totalRollVoters = Math.max(voters.length, enrollments.length, seats.length * 15);
    const overallTurnout = totalRollVoters > 0
      ? Math.min(100, Number(((totalVotesCast / totalRollVoters) * 100).toFixed(1)))
      : 0;

    return NextResponse.json({
      success: true,
      level: meta || {
        key: 'all',
        title: 'All Election Tiers',
        subtitle: 'Unified Cross-Tier Governance View',
        role: 'All Representatives',
        badge: 'All Tiers',
        tier: 'All Tiers',
        description: 'Comprehensive overview across Assembly, Lok Sabha, Municipal, and Panchayat tiers.',
        unitLabel: 'Seat / Ward',
        unitPlural: 'Seats & Wards',
        color: '#0078D4',
      },
      election: election
        ? {
            id: election.electionId,
            title: election.title,
            phase: election.phase,
            guardianApproved: Boolean(election.guardianApproved),
          }
        : null,
      stats: {
        totalSeats: seats.length,
        totalRegisteredVoters: totalRollVoters,
        totalVotesCast,
        turnoutPercentage: overallTurnout,
        appVotes: totalAppVotes,
        stationVotes: totalStationVotes,
        remoteVotes: totalRemoteVotes,
        totalCandidates: candidates.length,
      },
      seats: seatsAnalytics,
      parties,
    });
  } catch (err) {
    console.error('[analytics/level GET error]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch tier analytics.' },
      { status: 500 }
    );
  }
}
