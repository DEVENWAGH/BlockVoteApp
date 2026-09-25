/**
 * GET /api/voters/template
 * Returns a downloadable CSV template for voter bulk upload.
 */
import { NextResponse } from "next/server";

const TEMPLATE = `name,email,phone,gender,age,region,state,city,village,localityType,cityTier
Voter Name,voter.name@your-org.in,9876543210,Female,24,Maharashtra,Maharashtra,Pune,,Urban,Tier 1
Second Voter,second.voter@your-org.in,,Male,31,Maharashtra,Maharashtra,Karad,Malkapur,Rural,Tier 3
`;

export async function GET() {
  return new NextResponse(TEMPLATE, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="voter_upload_template.csv"',
    },
  });
}
