import { NextResponse } from "next/server"
import { canonicalTemplateCsv } from "@/lib/collection-import"

export async function GET() {
  return new NextResponse(canonicalTemplateCsv(), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="plantilla-cobranza.csv"',
      "cache-control": "no-store",
    },
  })
}
