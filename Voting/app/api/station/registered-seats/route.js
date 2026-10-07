import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Constituency from '@/lib/models/Constituency';
import Voter from '@/lib/models/Voter';
import Election from '@/lib/models/Election';
import Booth from '@/lib/models/Booth';

/**
 * GET /api/station/registered-seats
 * Aggregates all registered seats and polling areas with their voter counts
 * and active election context so users can click 1 button to enter any station.
 */
export async function GET() {
  try {
    await connectDB();

    const [constituencies, voters, elections, activeBooths] = await Promise.all([
      Constituency.find({}).sort({ level: 1, name: 1 }).lean(),
      Voter.find({}).lean(),
      Election.find({ phase: { $ne: 2 } }).sort({ createdAt: -1 }).lean(),
      Booth.find({}).lean(),
    ]);

    // Choose default active election
    const activeElection = elections[0] || (await Election.findOne({}).sort({ createdAt: -1 }).lean()) || null;
    const electionId = activeElection?.electionId || 'default_election';
    const electionTitle = activeElection?.title || 'General Election';

    // Group voters by constituency and polling stations
    const votersBySeat = new Map();
    const stationBySeat = new Map();
    const votersByStation = new Map();

    for (const v of voters) {
      const ac = v.assemblyConstituency?.toUpperCase();
      const pc = v.parliamentaryConstituency?.toUpperCase();
      const station = v.homePollingStation || '';

      if (ac) {
        if (!votersBySeat.has(ac)) votersBySeat.set(ac, []);
        votersBySeat.get(ac).push(v);
        if (station && !stationBySeat.has(ac)) stationBySeat.set(ac, station);
      }
      if (pc) {
        if (!votersBySeat.has(pc)) votersBySeat.set(pc, []);
        votersBySeat.get(pc).push(v);
        if (station && !stationBySeat.has(pc)) stationBySeat.set(pc, station);
      }
      if (station) {
        if (!votersByStation.has(station)) votersByStation.set(station, []);
        votersByStation.get(station).push(v);
      }
    }

    const boothsByCode = new Map(activeBooths.map((b) => [b.code, b]));

    // Build structured registered stations / seats
    const registeredSeats = constituencies.map((c) => {
      const code = c.code.toUpperCase();
      const seatVoters = votersBySeat.get(code) || [];
      const suggestedStation = stationBySeat.get(code) || `${c.name} Central Polling Station`;
      const boothCode = `BOOTH-${code}`;
      const existingBooth = boothsByCode.get(boothCode);

      return {
        _id: String(c._id),
        code: c.code,
        name: c.name,
        level: c.level,
        state: c.state || 'Maharashtra',
        district: c.district || seatVoters[0]?.district || '',
        city: c.city || seatVoters[0]?.city || '',
        pollingStation: suggestedStation,
        boothCode,
        voterCount: seatVoters.length,
        ballotsCast: existingBooth?.ballots || 0,
        isBoothActive: Boolean(existingBooth),
        lastActivatedAt: existingBooth?.lastActivatedAt || null,
        electionId,
        electionTitle,
      };
    });

    // Also include any standalone polling stations recorded in Voter roll that don't match standard seats
    for (const [stationName, stationVotersList] of votersByStation.entries()) {
      const alreadyIncluded = registeredSeats.some((s) => s.pollingStation.toLowerCase() === stationName.toLowerCase());
      if (!alreadyIncluded && stationName) {
        const sampleVoter = stationVotersList[0];
        const code = sampleVoter?.assemblyConstituency || `PS-${stationName.slice(0, 4).toUpperCase()}`;
        registeredSeats.push({
          _id: `ps-${stationName.replace(/\s+/g, '-').toLowerCase()}`,
          code,
          name: `${stationName} Area`,
          level: 'station',
          state: sampleVoter?.state || 'Maharashtra',
          district: sampleVoter?.district || 'Raigad',
          city: sampleVoter?.city || '',
          pollingStation: stationName,
          boothCode: `BOOTH-${code}`,
          voterCount: stationVotersList.length,
          ballotsCast: 0,
          isBoothActive: false,
          lastActivatedAt: null,
          electionId,
          electionTitle,
        });
      }
    }

    // Sort: stations with voters first, then alphabetically
    registeredSeats.sort((a, b) => b.voterCount - a.voterCount || a.name.localeCompare(b.name));

    return NextResponse.json({
      seats: registeredSeats,
      total: registeredSeats.length,
      activeElection: {
        id: electionId,
        title: electionTitle,
      },
    });
  } catch (err) {
    console.error('Failed to get registered seats for station:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch seats' }, { status: 500 });
  }
}
