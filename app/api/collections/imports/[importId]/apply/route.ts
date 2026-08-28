import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { z } from "zod"

type Context = { params: Promise<{ importId: string }> }

export async function POST(request: NextRequest, { params }: Context) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const { importId } = await params
  const supabase = await createClient()
  const { data: batch } = await supabase.from("collection_import_batches").select("id, status").eq("id", importId).maybeSingle()
  if (!batch) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 })
  if (batch.status === "applied") return NextResponse.json({ error: "El lote ya fue aplicado", status: batch.status }, { status: 409 })
  const parsed = z.object({ row_ids: z.array(z.string().uuid()).min(1) }).safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Selección de filas inválida" }, { status: 422 })
  const { data, error } = await supabase.rpc("apply_collection_import_batch", {
    p_batch_id: importId, p_actor_id: session.userId, p_row_ids: parsed.data.row_ids,
  })
  if (error) return NextResponse.json({ error: "No se pudo aplicar el lote", details: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function GET(_request: NextRequest, { params }: Context) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const { importId } = await params
  const { data, error } = await (await createClient()).from("collection_import_rows")
    .select("row_number, status, errors, warnings, obligation_id, dedupe_key").eq("batch_id", importId).order("row_number")
  if (error) return NextResponse.json({ error: "No se pudo cargar el resultado" }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}
