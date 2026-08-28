import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { debtorTransitionSchema } from "@/lib/collections"

type Context = { params: Promise<{ debtorId: string }> }

export async function GET(_request: NextRequest, { params }: Context) {
  const session = await requireAdmin()
  if (isNextResponse(session)) return session
  const { debtorId } = await params
  const supabase = await createClient()

  const { data: debtor, error } = await supabase
    .from("collection_debtor_summary").select("*").eq("id", debtorId).maybeSingle()
  if (error) return NextResponse.json({ error: "No se pudo cargar el deudor" }, { status: 500 })
  if (!debtor) return NextResponse.json({ error: "Deudor no encontrado" }, { status: 404 })

  const [{ data: obligations }, { data: contacts }] = await Promise.all([
    supabase
      .from("collection_obligations")
      .select("id, due_date, amount, balance, currency, installment_number, status, external_reference, policies(id, numero_poliza), companies(id, name), collection_payment_events(id, amount, currency, paid_at, reference, note)")
      .eq("debtor_id", debtorId)
      .order("due_date", { ascending: true }),
    supabase
      .from("collection_contacts")
      .select("id, channel, outcome, note, next_action_at, created_at, obligation_id")
      .eq("debtor_id", debtorId)
      .order("created_at", { ascending: false })
      .limit(100),
  ])

  return NextResponse.json({ ...debtor, obligations: obligations || [], contacts: contacts || [] })
}

/** Mover la tarjeta de columna. Queda registrado como gestión. */
export async function PATCH(request: NextRequest, { params }: Context) {
  const session = await requireAdmin()
  if (isNextResponse(session)) return session
  const { debtorId } = await params

  const parsed = debtorTransitionSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos inválidos" }, { status: 422 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("transition_debtor_status", {
    p_debtor_id: debtorId,
    p_actor_id: session.userId,
    p_status: parsed.data.status,
    p_note: parsed.data.note ?? null,
    p_next_action_at: parsed.data.next_action_at ?? null,
  })
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : error.code === "22023" ? 422 : 500
    return NextResponse.json({ error: error.code === "22023" ? "La nota es obligatoria para ese estado" : "No se pudo mover el deudor" }, { status })
  }
  return NextResponse.json({ resource: data })
}
