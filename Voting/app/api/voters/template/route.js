/**
 * GET /api/voters/template
 * Returns a downloadable CSV template for voter bulk upload.
 */
import { NextResponse } from "next/server";

const TEMPLATE = `name,email,phone,gender,age
Kalpit Mhatre,kalpitam25hmca@student.mes.ac.in,8765912438,Male,22
Deven Wagh,deveniw25hmca@student.mes.ac.in,9347826150,Male,23
Rohit Zagade,rohitrz25hmca@student.mes.ac.in,8916247530,Male,24
Tejas Lavate,tejasrl25hmca@student.mes.ac.in,9783124568,Male,23
Amogh Kalyanshetty,amoghpk25hmca@student.mes.ac.in,8459172630,Male,21
Parag Gonji,paragpg25hmca@student.mes.ac.in,9237618450,Male,22
Vedant Karade,vedantsk25hmca@student.mes.ac.in,8264957318,Male,45
Shashank,shashanksb25hmca@student.mes.ac.in,9265837140,Male,50
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
