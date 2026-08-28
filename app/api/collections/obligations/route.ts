import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { collectionSelect, collectionStatuses, obligationInputSchema } from "@/lib/collections"
import { z } from "zod"

const uuidSchema = z.string().uuid()
function escapeIlike(value: string) { return value.replace(/[\\%_(),.]/g, (character) => `\\${character}`) }
function parsePage(value: string | null, fallback: number, max: number) {
  const parsed = Number(value ?? fallback)
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, max) : fallback
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin()
  if (isNextResponse(session)) return session
  const params = request.nextUrl.searchParams
  const supabase = await createClient()
  let query = supabase.from("collection_obligations").select(collectionSelect(), { count: "exact" })
  const status = params.get("status")
  const companyId = params.get("company_id")
  const q = params.get("q")?.trim()
  if (status && !collectionStatuses.includes(status as (typeof collectionStatuses)[number])) return NextResponse.json({ error: "Estado inválido" }, { status: 422 })
  if (status) query = query.eq("status", status)
  if (companyId) {
    const parsedCompany = uuidSchema.safeParse(companyId)
    if (!parsedCompany.success) return NextResponse.json({ error: "Compañía inválida" }, { status: 422 })
    query = query.eq("company_id", parsedCompany.data)
  }
  if (q) { const safe = escapeIlike(q); query = query.or(`external_reference.ilike.%${safe}%,policy_number_snapshot.ilike.%${safe}%`) }
  const limit = Math.max(parsePage(params.get("limit"), 50, 100), 1)
  const offset = parsePage(params.get("offset"), 0, Number.MAX_SAFE_INTEGER)
  const { data, error, count } = await query.order("due_date", { ascending: true }).range(offset, offset + limit - 1)
  if (error) return NextResponse.json({ error: "No se pudo cargar la cartera" }, { status: 500 })
  return NextResponse.json({ data: data || [], count: count || 0, limit, offset })
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (isNextResponse(session)) return session
  const parsed = obligationInputSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 422 })
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_collection_obligation", { p_actor_id: session.userId, p_payload: parsed.data })
  if (error) return NextResponse.json({ error: "No se pudo registrar la obligación" }, { status: error.code === "23505" ? 409 : 500 })
  return NextResponse.json(data, { status: 201 })
}
