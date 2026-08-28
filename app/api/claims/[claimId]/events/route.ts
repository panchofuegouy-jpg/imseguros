import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { claimEventInputSchema, assertClaimTransition } from "@/lib/operations-domain"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const supabase = await createClient(); const { claimId } = await params
  const { data, error } = await supabase.from("claim_events").select("*").eq("claim_id", claimId).order("effective_at", { ascending: false })
  if (error) return NextResponse.json({ error: "No se pudo cargar el timeline" }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const parsed = claimEventInputSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Evento inválido", details: parsed.error.flatten() }, { status: 422 })
  const supabase = await createClient(); const { claimId } = await params
  const { data: claim } = await supabase.from("claims").select("id, status").eq("id", claimId).maybeSingle()
  if (!claim) return NextResponse.json({ error: "Siniestro no encontrado" }, { status: 404 })
  if (parsed.data.type === "status_changed") {
    try { assertClaimTransition(claim.status, parsed.data.to_status!, parsed.data.reason) } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Transición inválida" }, { status: 422 }) }
    if (parsed.data.from_status !== claim.status) return NextResponse.json({ error: "El estado origen ya no coincide", code: "STALE_STATUS" }, { status: 409 })
  }
  const { data, error } = await supabase.rpc("append_claim_event_atomic", {
    p_claim_id: claimId, p_actor_id: session.userId,
    p_type: parsed.data.type, p_from_status: parsed.data.from_status ?? null,
    p_to_status: parsed.data.to_status ?? null,
    p_payload: { ...parsed.data.payload, ...(parsed.data.reason ? { reason: parsed.data.reason } : {}) },
    p_effective_at: parsed.data.effective_at ?? null,
  })
  if (error) return NextResponse.json({ error: "No se pudo registrar el evento" }, { status: error.code === "P0002" ? 404 : error.code === "P0001" ? 409 : 500 })
  return NextResponse.json({ event: data?.event ?? data, resource: data?.claim ?? null }, { status: 201 })
}
