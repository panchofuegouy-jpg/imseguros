import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { claimPatchSchema, claimSelect, transitionClaim } from "@/lib/claims"
import { transitionResponse } from "@/lib/operations-domain"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const session = await requireAdmin()
  if (isNextResponse(session)) return session
  const supabase = await createClient()
  const { claimId } = await params
  const { data, error } = await supabase.from("claims").select(`${claimSelect}, claim_events(*)`).eq("id", claimId).maybeSingle()
  if (error) return NextResponse.json({ error: "No se pudo cargar el siniestro" }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Siniestro no encontrado" }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const session = await requireAdmin()
  if (isNextResponse(session)) return session
  const parsed = claimPatchSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 422 })
  const { claimId } = await params
  const supabase = await createClient()
  const { data: current, error: currentError } = await supabase.from("claims").select("*").eq("id", claimId).maybeSingle()
  if (currentError) return NextResponse.json({ error: "No se pudo cargar el siniestro" }, { status: 500 })
  if (!current) return NextResponse.json({ error: "Siniestro no encontrado" }, { status: 404 })
  const { reason, ...updates } = parsed.data
  let transition: ReturnType<typeof transitionClaim> | null = null
  if (updates.status && updates.status !== current.status) {
    try { transition = transitionClaim(current.status, updates.status, reason) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Transición inválida" }, { status: 422 }) }
  }
  if (transition) {
    const { error } = await supabase.rpc("transition_claim_atomic", {
      p_claim_id: claimId, p_actor_id: session.userId,
      p_updates: updates, p_reason: transition?.reason ?? reason ?? null,
    })
    if (error) return NextResponse.json({ error: "No se pudo actualizar el siniestro" }, { status: error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 409 })
  } else {
    const { error } = await supabase.from("claims").update(updates).eq("id", claimId)
    if (error) return NextResponse.json({ error: "No se pudo actualizar el siniestro" }, { status: 500 })
  }
  const { data, error } = await supabase.from("claims").select(claimSelect).eq("id", claimId).single()
  if (error) return NextResponse.json({ error: "Siniestro actualizado, pero no se pudo leer el resultado" }, { status: 500 })
  const { data: event } = await supabase.from("claim_events").select("*").eq("claim_id", claimId).order("created_at", { ascending: false }).limit(1).maybeSingle()
  return NextResponse.json(transitionResponse(data, event))
}
