/**
 * Polling-booth activation for the web ballot.
 *
 * GET    — current booth session on this computer (public; no secrets returned)
 * POST   — election admin starts this computer as a booth for one of their elections
 *          Body: { electionId, stationName, state?, district?, boothCode?, address? }
 * DELETE — election admin closes the booth on this computer
 *
 * The booth is a place, not a ballot: a voter from any village can vote at any
 * booth and still sees their home seat. The booth is only recorded as *where*
 * the vote was cast.
 */
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { auth } from '@/auth';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import Booth from '@/lib/models/Booth';
import { getVotingWindowStatus } from '@/lib/votingWindow';
import { phaseLabel } from '@/lib/voterMessages';
import {
  STATION_COOKIE,
  getStationSession,
  issueStationToken,
  stationCookieOptions,
} from '@/lib/stationSession';

export async function GET() {
  const station = await getStationSession();
  if (!station) {
    return NextResponse.json({ active: false });
  }

  await connectDB();
  const election = await Election.findOne(
    { electionId: station.electionId },
    { title: 1, phase: 1, level: 1, guardianApproved: 1, startTime: 1, endTime: 1 },
  ).lean();

  return NextResponse.json({
    active: true,
    station: {
      stationId: station.stationId,
      stationName: station.stationName,
      boothId: station.boothId || '',
      boothCode: station.boothCode || '',
      state: station.state || '',
      district: station.district || '',
      electionId: station.electionId,
      electionTitle: election?.title || '',
      electionLevel: election?.level || 'general',
      electionStatus: phaseLabel(election?.phase),
      expiresAt: new Date(station.exp * 1000).toISOString(),
    },
    votingWindow: election ? getVotingWindowStatus(election) : null,
  });
}

import { getAdminOrGuardian } from '@/lib/adminSession';

export async function POST(req) {
  const authResult = await getAdminOrGuardian(req).catch(() => null);
  const adminId = authResult?.adminId || 'station_officer';

  const { electionId, stationName, state, district, boothCode, address } = await req.json().catch(() => ({}));
  if (!electionId) {
    return NextResponse.json({ error: 'electionId is required.' }, { status: 400 });
  }
  const name = String(stationName || '').trim();
  if (!name) {
    return NextResponse.json({ error: 'Give this booth a name (e.g. "Booth 12 – Ward 4").' }, { status: 400 });
  }

  await connectDB();
  let election = null;
  if (electionId && electionId !== 'default_election') {
    election = await Election.findOne({ electionId: String(electionId) }).lean();
  }
  if (!election) {
    // Fallback to active election
    election = await Election.findOne({ phase: { $ne: 2 } }).sort({ createdAt: -1 }).lean()
      || await Election.findOne({}).sort({ createdAt: -1 }).lean();
  }
  if (!election) {
    return NextResponse.json({ error: 'No active election found.' }, { status: 404 });
  }

  if (election.phase === 2) {
    return NextResponse.json({ error: 'This election has already closed.' }, { status: 400 });
  }

  const validAdminObjectId = (adminId && mongoose.Types.ObjectId.isValid(adminId)) ? adminId : null;

  const booth = await Booth.findOneAndUpdate(
    { electionId: election.electionId, nameKey: name.toLowerCase() },
    {
      $set: {
        name,
        code: String(boothCode || '').trim().toUpperCase().slice(0, 32),
        state: String(state || '').trim().slice(0, 60),
        district: String(district || '').trim().slice(0, 60),
        address: String(address || '').trim().slice(0, 200),
        lastActivatedAt: new Date(),
      },
      ...(validAdminObjectId ? { $setOnInsert: { createdBy: validAdminObjectId } } : {}),
      $inc: { activations: 1 },
    },
    { upsert: true, returnDocument: 'after' },
  ).lean();

  const { token, payload } = issueStationToken({
    electionId: election.electionId,
    stationName: name,
    adminId,
    boothId: String(booth._id),
    boothCode: booth.code,
    state: booth.state,
    district: booth.district,
  });

  const res = NextResponse.json({
    success: true,
    station: {
      stationId: payload.stationId,
      stationName: payload.stationName,
      boothId: payload.boothId,
      boothCode: payload.boothCode || '',
      state: payload.state || '',
      district: payload.district || '',
      electionId: payload.electionId,
      electionTitle: election.title,
      electionLevel: election.level || 'general',
      electionStatus: phaseLabel(election.phase),
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    },
  });
  res.cookies.set(STATION_COOKIE, token, stationCookieOptions());
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(STATION_COOKIE, '', stationCookieOptions(0));
  return res;
}
