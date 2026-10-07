/**
 * GET /api/constituencies/template — downloadable seat-list CSV template.
 */
import { NextResponse } from 'next/server';

const TEMPLATE = `code,name,level,state,district,city,village,ward,parentCode
MH-PC-45,Satara,loksabha,Maharashtra,,,,,
MH-PC-34,Pune,loksabha,Maharashtra,,,,,
MH-AC-258,Karad North,assembly,Maharashtra,Satara,,,,MH-PC-45
MH-AC-210,Kothrud,assembly,Maharashtra,Pune,,,,MH-PC-34
PUNE-W17,Kothrud Ward 17,municipal,Maharashtra,Pune,Pune,,17,MH-AC-210
MALKAPUR-W4,Malkapur Ward 4,panchayat,Maharashtra,Satara,,Malkapur,4,MH-AC-258
`;

export async function GET() {
  return new NextResponse(TEMPLATE, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="seat_list_template.csv"',
    },
  });
}
