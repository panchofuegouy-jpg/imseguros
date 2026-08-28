import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { importRowSchema } from "@/lib/collection-import-server"

type Context = { params: Promise<{ importId: string }> }

export async function GET(_request: NextRequest, { params }: Context) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const { importId } = await params
  const supabase = await createClient()
  const { data: batch, error } = await supabase.from("collection_import_batches").select("*").eq("id", importId).maybeSingle()
  if (error) return NextResponse.json({ error: "No se pudo cargar el lote" }, { status: 500 })
  if (!batch) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 })
  const { data: rows, error: rowsError } = await supabase.from("collection_import_rows").select("*").eq("batch_id", importId).order("row_number")
  if (rowsError) return NextResponse.json({ error: "No se pudieron cargar las filas" }, { status: 500 })
  return NextResponse.json({ ...batch, rows: rows || [] })
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const { importId } = await params
  const parsed = importRowSchema.partial().extend({ status: importRowSchema.shape.status.optional() }).safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Fila inválida", details: parsed.error.flatten() }, { status: 422 })
  const { rowNumber, ...update } = parsed.data
  if (!rowNumber) return NextResponse.json({ error: "rowNumber es obligatorio" }, { status: 422 })
  const supabase = await createClient()
  const { data, error } = await supabase.from("collection_import_rows").update({
    ...(update.raw ? { raw_payload: update.raw } : {}),
    ...(update.normalized ? { normalized_payload: update.normalized } : {}),
    ...(update.errors ? { errors: update.errors } : {}),
    ...(update.warnings ? { warnings: update.warnings } : {}),
    ...(update.dedupeKey !== undefined ? { dedupe_key: update.dedupeKey } : {}),
    ...(update.status ? { status: update.status } : {}),
  }).eq("batch_id", importId).eq("row_number", rowNumber).select("*").maybeSingle()
  if (error) return NextResponse.json({ error: "No se pudo actualizar la fila" }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Fila no encontrada" }, { status: 404 })
  return NextResponse.json(data)
}
