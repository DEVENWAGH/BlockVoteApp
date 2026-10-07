/**
 * POST /api/org/[slug]/elections/[id]/candidates/upload-csv  (multipart: file)
 * Columns: constituencyCode,name,partyCode,manifesto
 * (constituencyCode may be blank for single-ballot elections)
 *
 * Each row is one on-chain transaction, so files are capped at 300 rows.
 * The party symbol is taken from the Party record; one candidate per party per seat.
 */
import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import connectDB from '@/lib/db';
import Election from '@/lib/models/Election';
import Candidate from '@/lib/models/Candidate';
import Party from '@/lib/models/Party';
import Constituency from '@/lib/models/Constituency';
import { relayAddCandidate } from '@/lib/relay';
import { resolveAssetUrl } from '@/lib/urlUtils';
import { getRequestOrigin } from '@/lib/s3';
import { auth } from '@/auth';
import { usesSeatFiltering, normalizeCode } from '@/lib/seats';

const MAX_ROWS = 300;

const ALIASES = {
  constituencycode: 'constituencyCode', seat: 'constituencyCode', seatcode: 'constituencyCode', constituency: 'constituencyCode', ac: 'constituencyCode', acno: 'constituencyCode',
  name: 'name', candidate: 'name', candidatename: 'name',
  partycode: 'partyCode', party: 'partyCode', partyname: 'partyCode',
  manifesto: 'manifesto', promise: 'manifesto', promises: 'manifesto',
};

function canon(h) {
  return ALIASES[String(h || '').replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]/g, '')] || null;
}

import { getAdminOrGuardian } from '@/lib/adminSession';

export async function POST(req, { params }) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const electionId = String(id);
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'No file received' }, { status: 400 });

    await connectDB();
    const election = await Election.findOne({ electionId }).lean();
    if (!election) return NextResponse.json({ error: 'Election not found' }, { status: 404 });
    if (election.createdBy && !authResult.isGuardian && String(election.createdBy) !== String(authResult.adminId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (election.phase !== 0 && !authResult.isGuardian) {
      return NextResponse.json({ error: 'Candidates can only be added before voting opens' }, { status: 400 });
    }

    const text = new TextDecoder().decode(await file.arrayBuffer());
    let records;
    try {
      records = parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true });
    } catch {
      return NextResponse.json({ error: 'Invalid CSV format.' }, { status: 400 });
    }
    if (!records.length) return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    if (records.length > MAX_ROWS) {
      return NextResponse.json({ error: `Upload at most ${MAX_ROWS} candidates per file.` }, { status: 400 });
    }

    const mapping = {};
    for (const h of Object.keys(records[0])) {
      const c = canon(h);
      if (c) mapping[h] = c;
    }
    const present = new Set(Object.values(mapping));
    for (const required of ['name', 'partyCode']) {
      if (!present.has(required)) {
        return NextResponse.json({ error: `Missing required column: ${required}. Expected: constituencyCode,name,partyCode,manifesto` }, { status: 400 });
      }
    }

    const filtered = usesSeatFiltering(election);
    const parties = await Party.find({}).lean();
    const partyByCode = new Map(parties.map((p) => [p.code, p]));
    const partyByName = new Map(parties.map((p) => [p.name.toLowerCase(), p]));
    const seats = filtered ? await Constituency.find({ level: election.level }).lean() : [];
    const seatByCode = new Map(seats.map((s) => [s.code, s]));
    const origin = getRequestOrigin(req);

    const existing = await Candidate.find({ electionId }).select('partyCode constituencyCode name').lean();
    const taken = new Set(existing.map((c) => `${c.partyCode}|${c.constituencyCode}`));

    const added = [];
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const row = {};
      for (const [h, c] of Object.entries(mapping)) row[c] = String(rec[h] ?? '').trim();
      const rowNum = i + 2;

      const name = row.name;
      const partyKey = normalizeCode(row.partyCode);
      const party = partyByCode.get(partyKey) || partyByName.get(String(row.partyCode || '').toLowerCase());
      const seatCode = filtered ? normalizeCode(row.constituencyCode) : '';
      const seat = filtered ? seatByCode.get(seatCode) : null;

      const problems = [];
      if (!name) problems.push('name is blank');
      if (!party) problems.push(`party "${row.partyCode}" is not in the party list`);
      if (filtered && !seatCode) problems.push('constituencyCode is blank');
      if (filtered && seatCode && !seat) problems.push(`seat "${seatCode}" is not a ${election.level} seat`);
      if (party && !party.allowMultiplePerSeat && taken.has(`${party.code}|${seatCode}`)) {
        problems.push(`${party.name} already has a candidate in ${seat?.name || 'this election'}`);
      }
      if (problems.length) {
        errors.push({ row: rowNum, name: name || '—', reason: problems.join('; ') });
        continue;
      }

      try {
        const symbolUrl = resolveAssetUrl(party.symbol, origin);
        const { txHash, blockNumber, candidateId: chainId } = await relayAddCandidate(
          electionId, name, party.name, symbolUrl, row.manifesto || '', '', '',
        );
        const candidateId = chainId ?? (await Candidate.countDocuments({ electionId }));
        await Candidate.findOneAndUpdate(
          { electionId, candidateId },
          {
            $set: {
              name,
              party: party.name,
              partyId: party._id,
              partyCode: party.code,
              symbol: symbolUrl,
              manifesto: row.manifesto || '',
              constituencyCode: seatCode,
              constituencyName: seat?.name || '',
              state: seat?.state || '',
              district: seat?.district || '',
              city: seat?.city || '',
              village: seat?.village || '',
              txHash,
              blockNumber,
            },
          },
          { upsert: true },
        );
        taken.add(`${party.code}|${seatCode}`);
        added.push({ row: rowNum, name, party: party.name, seat: seat?.name || '', candidateId });
      } catch (err) {
        errors.push({ row: rowNum, name, reason: err.message || 'on-chain add failed' });
      }
    }

    const total = await Candidate.countDocuments({ electionId });
    await Election.updateOne({ electionId }, { $set: { candidateCount: total } });

    return NextResponse.json({
      success: true,
      total: records.length,
      added: added.length,
      candidates: added,
      errors: errors.slice(0, 50),
      hasMoreErrors: errors.length > 50,
    });
  } catch (err) {
    console.error('[candidates upload-csv]', err);
    return NextResponse.json({ error: err.message || 'Candidate import failed' }, { status: 500 });
  }
}
