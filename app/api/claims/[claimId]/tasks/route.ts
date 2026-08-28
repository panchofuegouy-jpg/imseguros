import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { taskSchema } from "@/lib/claims"
import { z } from "zod"

type Context = { params: Promise<{ claimId: string }> }

export async function GET(_request: NextRequest, { params }: Context) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const { claimId } = await params
  const { data, error } = await (await createClient()).from("tasks").select("*")
    .eq("claim_id", claimId)
    .order("due_at", { ascending: true, nullsFirst: false })
  if (error) return NextResponse.json({ error: "No se pudieron cargar los pendientes" }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest, { params }: Context) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const parsed = taskSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Pendiente inválido" }, { status: 422 })
  const { claimId } = await params; const supabase = await createClient()
  const { data: claim } = await supabase.from("claims").select("id").eq("id", claimId).maybeSingle()
  if (!claim) return NextResponse.json({ error: "Siniestro no encontrado" }, { status: 404 })
  const { data, error } = await supabase.from("tasks")
    .insert({ ...parsed.data, claim_id: claimId, created_by: session.userId })
    .select().single()
  if (error) return NextResponse.json({ error: "No se pudo crear el pendiente" }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

/** Marcar un pendiente como hecho o cancelado. */
export async function PATCH(request: NextRequest, { params }: Context) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(["open", "in_progress", "blocked", "done", "cancelled"]) })
    .safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 422 })
  const { claimId } = await params
  const { data, error } = await (await createClient()).from("tasks")
    .update({ status: parsed.data.status, completed_at: parsed.data.status === "done" ? new Date().toISOString() : null })
    .eq("id", parsed.data.id).eq("claim_id", claimId)
    .select().maybeSingle()
  if (error) return NextResponse.json({ error: "No se pudo actualizar el pendiente" }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Pendiente no encontrado" }, { status: 404 })
  return NextResponse.json(data)
}
