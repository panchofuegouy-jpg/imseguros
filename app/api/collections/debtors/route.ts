import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { debtorStatuses } from "@/lib/collections"

/** El tablero de cobranza: una fila por persona, con su deuda ya sumada. */
export async function GET(request: NextRequest) {
  const session = await requireAdmin()
  if (isNextResponse(session)) return session

  const params = request.nextUrl.searchParams
  const supabase = await createClient()

  let query = supabase.from("collection_debtor_summary").select("*")

  const status = params.get("status")
  if (status) {
    if (!(debtorStatuses as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "Estado de gestión inválido" }, { status: 422 })
    }
    query = query.eq("status", status)
  }

  const assignee = params.get("assignee_id")
  if (assignee) query = query.eq("assignee_id", assignee)

  const search = params.get("q")?.trim()
  if (search) {
    const safe = search.replace(/[\\%_(),.]/g, (character) => `\\${character}`)
    query = query.or(`display_name.ilike.%${safe}%,document.ilike.%${safe}%`)
  }

  // El más urgente primero: quien tiene el próximo paso vencido, después por
  // vencimiento más antiguo.
  const { data, error } = await query
    .order("next_action_at", { ascending: true, nullsFirst: false })
    .order("vencimiento_mas_antiguo", { ascending: true, nullsFirst: false })
    .limit(500)

  if (error) return NextResponse.json({ error: "No se pudo cargar la cartera" }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}
