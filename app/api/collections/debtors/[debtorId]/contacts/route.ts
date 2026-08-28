import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { contactSchema } from "@/lib/collections"

type Context = { params: Promise<{ debtorId: string }> }

/** Una gestión es sobre la persona; la cuota puntual es opcional. */
export async function POST(request: NextRequest, { params }: Context) {
  const session = await requireAdmin()
  if (isNextResponse(session)) return session
  const { debtorId } = await params

  const parsed = contactSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 422 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("record_collection_contact", {
    p_debtor_id: debtorId,
    p_actor_id: session.userId,
    p_channel: parsed.data.channel,
    p_outcome: parsed.data.outcome,
    p_note: parsed.data.note || null,
    p_next_action_at: parsed.data.next_action_at || null,
    p_obligation_id: parsed.data.obligation_id || null,
  })
  if (error) {
    const status = error.code === "P0002" ? 404 : error.code === "42501" ? 403 : error.code === "23514" ? 422 : 400
    return NextResponse.json({ error: "No se pudo registrar la gestión" }, { status })
  }
  return NextResponse.json({ resource: data }, { status: 201 })
}
