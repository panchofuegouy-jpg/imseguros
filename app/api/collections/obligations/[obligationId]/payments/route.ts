import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { paymentSchema } from "@/lib/collections"

type Context = { params: Promise<{ obligationId: string }> }

export async function POST(request: NextRequest, { params }: Context) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const { obligationId } = await params
  const parsed = paymentSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 422 })
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("record_collection_payment", {
    p_obligation_id: obligationId,
    p_actor_id: session.userId,
    p_amount: parsed.data.amount,
    p_currency: parsed.data.currency,
    p_paid_at: parsed.data.paid_at || new Date().toISOString(),
    p_reference: parsed.data.reference || null,
    p_note: parsed.data.note || null,
    p_idempotency_key: parsed.data.idempotency_key,
  })
  if (error) {
    const status = error.code === "P0002" ? 404 : error.code === "22003" || error.code === "22023" ? 409 : 400
    return NextResponse.json({ error: "No se pudo registrar el pago" }, { status })
  }
  return NextResponse.json({ payment: data }, { status: 201 })
}
