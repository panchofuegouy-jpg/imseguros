import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { collectionSelect, obligationPatchSchema } from "@/lib/collections"

type Context = { params: Promise<{ obligationId: string }> }

export async function GET(_request: NextRequest, { params }: Context) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const { obligationId } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.from("collection_obligations")
    .select(`${collectionSelect()}, collection_contacts(*), collection_payment_events(*)`)
    .eq("id", obligationId).maybeSingle()
  if (error) return NextResponse.json({ error: "No se pudo cargar la obligación" }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Obligación no encontrada" }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const { obligationId } = await params
  const parsed = obligationPatchSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 422 })
  const supabase = await createClient()
  const { data: current } = await supabase.from("collection_obligations").select("id, status, balance").eq("id", obligationId).maybeSingle()
  if (!current) return NextResponse.json({ error: "Obligación no encontrada" }, { status: 404 })
  if (current.status === "paid" && parsed.data.status && parsed.data.status !== "paid") return NextResponse.json({ error: "Una obligación pagada no puede reabrirse" }, { status: 409 })
  const { reason, status, ...updatePayload } = parsed.data
  const { data: transitioned, error: transitionError } = await supabase.rpc("transition_collection_obligation", {
    p_obligation_id: obligationId, p_actor_id: session.userId,
    p_status: status ?? current.status, p_reason: reason ?? null, p_updates: updatePayload,
  })
  if (transitionError) return NextResponse.json({ error: "No se pudo cambiar el estado de la obligación" }, { status: transitionError.code === "23505" ? 409 : transitionError.code === "22023" ? 422 : 500 })
  const { data, error } = await supabase.from("collection_obligations").select(collectionSelect()).eq("id", transitioned.id).single()
  if (error) return NextResponse.json({ error: "No se pudo actualizar la obligación" }, { status: 500 })
  return NextResponse.json(data)
}
