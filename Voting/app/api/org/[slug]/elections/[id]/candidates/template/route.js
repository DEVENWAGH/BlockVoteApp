/**
 * GET /api/org/[slug]/elections/[id]/candidates/template — candidate CSV template.
 */
import { NextResponse } from 'next/server';

const TEMPLATE = `constituencyCode,name,partyCode,manifesto
MH-AC-258,Asha Patil,PP,Better roads and water for Karad North
MH-AC-258,Rohan Mehta,UF,Digital services for every village
MH-AC-210,Vikram Joshi,PP,Metro and parks for Kothrud
`;

export async function GET() {
  return new NextResponse(TEMPLATE, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="candidates_template.csv"',
    },
  });
}
