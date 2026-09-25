/**
 * Polling-station activation for the web ballot.
 *
 * GET    — current station session on this computer (public; no secrets returned)
 * POST   — election admin activates this computer as a station for one of their elections
 * DELETE — election admin closes the station on this computer
 */
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import { getVotingWindowStatus } from '@/lib/votingWindow';
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
    { title: 1, phase: 1, guardianApproved: 1, startTime: 1, endTime: 1 },
  ).lean();

  return NextResponse.json({
    active: true,
    station: {
      stationId: station.stationId,
      stationName: station.stationName,
      electionId: station.electionId,
      electionTitle: election?.title || '',
      expiresAt: new Date(station.exp * 1000).toISOString(),
    },
    votingWindow: election ? getVotingWindowStatus(election) : null,
  });
}

export async function POST(req) {
  const session = await auth();
  const adminId = session?.user?.adminId;
  if (!adminId) {
    return NextResponse.json({ error: 'Sign in as the election admin to activate a station.' }, { status: 401 });
  }

  const { electionId, stationName } = await req.json().catch(() => ({}));
  if (!electionId) {
    return NextResponse.json({ error: 'electionId is required.' }, { status: 400 });
  }
  const name = String(stationName || '').trim();
  if (!name) {
    return NextResponse.json({ error: 'Give this polling station a name (e.g. "Booth 12 – Ward 4").' }, { status: 400 });
  }

  await connectDB();
  const election = await Election.findOne({ electionId: String(electionId) }).lean();
  if (!election || String(election.createdBy) !== String(adminId)) {
    return NextResponse.json({ error: 'Election not found in your account.' }, { status: 404 });
  }
  if (election.phase === 2) {
    return NextResponse.json({ error: 'This election has already ended.' }, { status: 400 });
  }

  const { token, payload } = issueStationToken({
    electionId: election.electionId,
    stationName: name,
    adminId,
  });

  const res = NextResponse.json({
    success: true,
    station: {
      stationId: payload.stationId,
      stationName: payload.stationName,
      electionId: payload.electionId,
      electionTitle: election.title,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    },
  });
  res.cookies.set(STATION_COOKIE, token, stationCookieOptions());
  return res;
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.adminId) {
    return NextResponse.json({ error: 'Sign in as the election admin to close this station.' }, { status: 401 });
  }

  const station = await getStationSession();
  if (station && station.adminId !== String(session.user.adminId)) {
    return NextResponse.json({ error: 'Only the admin who opened this station can close it.' }, { status: 403 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(STATION_COOKIE, '', stationCookieOptions(0));
  return res;
}
