/**
 * POST /api/constituencies/upload-csv  (multipart: file)
 * Columns: code,name,level,state,district,city,village,ward,parentCode
 * Existing codes are updated; new codes are added.
 */
import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import connectDB from '@/lib/db';
import Constituency, { SEAT_LEVELS } from '@/lib/models/Constituency';
import { auth } from '@/auth';
import { normalizeCode } from '@/lib/seats';

const MAX_ROWS = 20_000;

const HEADER_ALIASES = {
  code: 'code', seatcode: 'code', constituencycode: 'code', acno: 'code', pcno: 'code',
  name: 'name', seatname: 'name', constituency: 'name', constituencyname: 'name',
  level: 'level', type: 'level',
  state: 'state',
  district: 'district',
  city: 'city', town: 'city',
  village: 'village', panchayat: 'village',
  ward: 'ward', wardno: 'ward',
  parentcode: 'parentCode', parent: 'parentCode', pc: 'parentCode',
};

function canon(h) {
  return HEADER_ALIASES[String(h || '').replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]/g, '')] || null;
}

const LEVEL_ALIASES = {
  panchayat: 'panchayat', gram: 'panchayat', grampanchayat: 'panchayat', village: 'panchayat',
  municipal: 'municipal', ward: 'municipal', city: 'municipal', corporation: 'municipal',
  assembly: 'assembly', ac: 'assembly', mla: 'assembly', vidhansabha: 'assembly',
  loksabha: 'loksabha', pc: 'loksabha', mp: 'loksabha', parliament: 'loksabha', parliamentary: 'loksabha',
};

import mongoose from 'mongoose';
import { getAdminOrGuardian } from '@/lib/adminSession';

export async function POST(req) {
  try {
    const authResult = await getAdminOrGuardian(req);
    if (!authResult?.ok) {
      return NextResponse.json({ error: 'Unauthorized — Guardian or Admin access required' }, { status: 401 });
    }
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) return NextResponse.json({ error: 'No file received' }, { status: 400 });

    const text = new TextDecoder().decode(await file.arrayBuffer());
    let records;
    try {
      records = parse(text, { columns: true, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true });
    } catch {
      return NextResponse.json({ error: 'Invalid CSV format.' }, { status: 400 });
    }
    if (!records.length) return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    if (records.length > MAX_ROWS) return NextResponse.json({ error: `CSV exceeds ${MAX_ROWS} rows` }, { status: 400 });

    const mapping = {};
    for (const h of Object.keys(records[0])) {
      const c = canon(h);
      if (c) mapping[h] = c;
    }
    const present = new Set(Object.values(mapping));
    for (const required of ['code', 'name', 'level', 'state']) {
      if (!present.has(required)) {
        return NextResponse.json({ error: `Missing required column: ${required}. Expected: code,name,level,state,district,city,village,ward,parentCode` }, { status: 400 });
      }
    }

    await connectDB();
    const ops = [];
    const errors = [];
    const seen = new Set();
    records.forEach((rec, i) => {
      const row = {};
      for (const [h, c] of Object.entries(mapping)) row[c] = String(rec[h] ?? '').trim();
      const code = normalizeCode(row.code);
      const level = LEVEL_ALIASES[row.level.toLowerCase().replace(/[^a-z]/g, '')] || '';
      const problems = [];
      if (!code) problems.push('code is blank');
      else if (seen.has(code)) problems.push('duplicate code in file');
      if (!row.name) problems.push('name is blank');
      if (!SEAT_LEVELS.includes(level)) problems.push(`level "${row.level}" is not one of ${SEAT_LEVELS.join(', ')}`);
      if (!row.state) problems.push('state is blank');
      if (level === 'municipal' && !row.city) problems.push('municipal seat needs a city');
      if (level === 'panchayat' && !row.village) problems.push('panchayat seat needs a village');
      if (problems.length) {
        errors.push({ row: i + 2, code: code || '—', reason: problems.join('; ') });
        return;
      }
      seen.add(code);
      const validAdminObjectId = (authResult.adminId && mongoose.Types.ObjectId.isValid(authResult.adminId))
        ? authResult.adminId
        : null;
      ops.push({
        updateOne: {
          filter: { code },
          update: {
            $set: {
              name: row.name,
              level,
              state: row.state,
              district: row.district || '',
              city: row.city || '',
              village: row.village || '',
              ward: row.ward || '',
              parentCode: normalizeCode(row.parentCode || ''),
            },
            $setOnInsert: { code, createdBy: validAdminObjectId },
          },
          upsert: true,
        },
      });
    });

    let added = 0;
    let updated = 0;
    if (ops.length) {
      const res = await Constituency.bulkWrite(ops, { ordered: false });
      added = res.upsertedCount || 0;
      updated = res.modifiedCount || 0;
    }

    return NextResponse.json({
      success: true,
      total: records.length,
      added,
      updated,
      errors: errors.slice(0, 50),
      hasMoreErrors: errors.length > 50,
    });
  } catch (err) {
    console.error('[constituencies upload-csv]', err);
    return NextResponse.json({ error: err.message || 'Seat import failed' }, { status: 500 });
  }
}
