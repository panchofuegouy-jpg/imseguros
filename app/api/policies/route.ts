import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"

/** PostgREST interpreta comas y paréntesis dentro de `.or(...)`. */
function escapeIlike(value: string) {
  return value.replace(/[\\%_(),.]/g, (character) => `\\${character}`)
}

/**
 * Listado de pólizas para los selectores de siniestros y cobranza. Devuelve lo
 * mínimo para identificar una póliza —número, tipo, titular y compañía— y no el
 * registro completo, que incluye notas y archivos.
 */
export async function GET(request: NextRequest) {
  const session = await requireAdmin()
  if (isNextResponse(session)) return session

  const params = request.nextUrl.searchParams
  const supabase = await createClient()

  let query = supabase
    .from("policies")
    .select("id, numero_poliza, tipo, vigencia_fin, status, clients(id, nombre, documento), companies(id, name)")

  const clientId = params.get("client_id")
  if (clientId) query = query.eq("client_id", clientId)

  const search = params.get("q")?.trim()
  if (search) {
    const safe = escapeIlike(search)
    query = query.or(`numero_poliza.ilike.%${safe}%,nombre_asegurado.ilike.%${safe}%,documento_asegurado.ilike.%${safe}%`)
  }

  const requestedLimit = Number(params.get("limit") || 20)
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 20

  const { data, error } = await query.order("vigencia_fin", { ascending: false }).limit(limit)
  if (error) return NextResponse.json({ error: "No se pudieron cargar las pólizas" }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}
