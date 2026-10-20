import { NextRequest, NextResponse } from "next/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { createClient } from "@/lib/supabase/server"
import { bseRowsSchema } from "@/lib/renewal-proposals"
import { matchBseRows } from "@/lib/renewal-proposals-server"

/** Cruza el export de BSE con la plataforma y calcula, sin guardar nada. */
export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (isNextResponse(session)) return session

  const body = await request.json().catch(() => null)
  const parsed = bseRowsSchema.safeParse(body?.rows)
  if (!parsed.success) {
    return NextResponse.json({ error: "El archivo no tiene el formato esperado de BSE." }, { status: 422 })
  }

  try {
    const result = await matchBseRows(await createClient(), parsed.data)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[renewal-proposals/preview]", error)
    return NextResponse.json({ error: "No se pudo cruzar el archivo con las pólizas. Probá de nuevo." }, { status: 500 })
  }
}
