/**
 * GET /api/voters/template
 * Downloadable CSV template for the master electoral roll.
 * Seat codes must exist in the shared seat list (Seats tab or /api/constituencies).
 */
import { NextResponse } from "next/server";
import { ROLL_COLUMNS } from "@/lib/rollValidation";

const SAMPLE_ROWS = [
  [
    "MES0000001", "Kalpit Mhatre", "kalpitam25hmca@student.mes.ac.in", "9823417650", "Male", "22",
    "Maharashtra", "Raigad", "Panvel", "", "7", "101", "MES Pillai College Hall",
    "MH-AC-188", "MH-PC-32",
  ],
  [
    "MES0000002", "Deven Wagh", "deveniw25hmca@student.mes.ac.in", "9867512340", "Male", "23",
    "Maharashtra", "Raigad", "Panvel", "", "7", "101", "MES Pillai College Hall",
    "MH-AC-188", "MH-PC-32",
  ],
  [
    "MES0000004", "Tejas Lavate", "tejasrl25hmca@student.mes.ac.in", "9834567890", "Male", "23",
    "Maharashtra", "Satara", "", "Malkapur", "4", "12", "ZP School Malkapur",
    "MH-AC-258", "MH-PC-45",
  ],
  [
    "MES0000006", "Parag Gonji", "paragpg25hmca@student.mes.ac.in", "9890123456", "Male", "22",
    "Maharashtra", "Pune", "Pune", "", "17", "88", "Municipal School Kothrud",
    "MH-AC-210", "MH-PC-34",
  ],
  [
    "MES0000018", "Vaishakh Nair", "vaishakhnairr28@gmail.com", "9820123456", "Male", "36",
    "Maharashtra", "Raigad", "Panvel", "", "8", "103", "Panvel Municipal School",
    "MH-AC-188", "MH-PC-32",
  ],
];

const TEMPLATE = [ROLL_COLUMNS.join(","), ...SAMPLE_ROWS.map((r) => r.join(","))].join("\n") + "\n";

export async function GET() {
  return new NextResponse(TEMPLATE, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="voter_roll_template.csv"',
    },
  });
}
