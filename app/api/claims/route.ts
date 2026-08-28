import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { claimCreateSchema, claimSelect } from "@/lib/claims"

export async function GET(request: NextRequest) {
  const session = await requireAdmin()
  if (isNextResponse(session)) return session
  const supabase = await createClient()
  const params = request.nextUrl.searchParams
  let query = supabase.from("claims").select(claimSelect, { count: "exact" })
  for (const field of ["status", "priority", "client_id", "policy_id", "assignee_id", "insurer_name"] as const) {
    const value = params.get(field)
    if (value) query = query.eq(field, value)
  }
  const search = params.get("q")?.trim()
  if (search) {
    const safe = search.replace(/[\\%_(),.]/g, (character) => `\\${character}`)
    query = query.or(`external_number.ilike.%${safe}%,claim_type.ilike.%${safe}%,description.ilike.%${safe}%`)
  }
  const requestedLimit = Number(params.get("limit") || 50)
  const requestedOffset = Number(params.get("offset") || 0)
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50
  const offset = Number.isInteger(requestedOffset) ? Math.max(requestedOffset, 0) : 0
  const { data, error, count } = await query.order("updated_at", { ascending: false }).range(offset, offset + limit - 1)
  if (error) return NextResponse.json({ error: "No se pudieron cargar los siniestros" }, { status: 500 })
  return NextResponse.json({ data, count, limit, offset })
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (isNextResponse(session)) return session
  const parsed = claimCreateSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 422 })
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_claim", { p_actor_id: session.userId, p_payload: parsed.data })
  if (error) return NextResponse.json({ error: "No se pudo crear el siniestro" }, { status: error.code === "23505" ? 409 : 500 })
  return NextResponse.json(data, { status: 201 })
}
