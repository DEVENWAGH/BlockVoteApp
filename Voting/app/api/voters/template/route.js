/**
 * GET /api/voters/template
 * Returns a downloadable CSV template for voter bulk upload.
 */
import { NextResponse } from "next/server";

const TEMPLATE = `name,email,phone,gender,age,region,state,city,village,localityType,cityTier
Kalpit Mhatre,kalpitam25hmca@student.mes.ac.in,8765912438,Male,22,Pune,Pune,Urban,Tier 1
Deven Wagh,deveniw25hmca@student.mes.ac.in,9347826150,Male,23,Pune,Pimpri-Chinchwad,Urban,Tier 1
Rohit Zagade,rohitrz25hmca@student.mes.ac.in,8916247530,Male,24,Satara,Karad,Rural,Tier 3
Tejas Lavate,tejasrl25hmca@student.mes.ac.in,9783124568,Male,23,Nashik,Nashik,Urban,Tier 2
Amogh Kalyanshetty,amoghpk25hmca@student.mes.ac.in,8459172630,Male,21,Kolhapur,Kolhapur,Urban,Tier 2
Parag Gonji,paragpg25hmca@student.mes.ac.in,9237618450,Male,22,Solapur,Pandharpur,Rural,Tier 3
Vedant Karade,vedantsk25hmca@student.mes.ac.in,8264957318,Male,45,Mumbai,Mumbai,Urban,Tier 1
Shashank,shashanksb25hmca@student.mes.ac.in,9265837140,Male,50,Raigad,Panvel,Urban,Tier 2
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
