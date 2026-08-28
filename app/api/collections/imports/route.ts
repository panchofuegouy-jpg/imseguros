import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { importBatchPayloadSchema, rowPayload } from "@/lib/collection-import-server"
import { createHash, randomUUID } from "node:crypto"

const STORAGE_BUCKET = "policy-documents"

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

export async function GET() {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const { data, error } = await (await createClient()).from("collection_import_batches")
    .select("*, company_import_mappings(id, company_id, version, mapping)")
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: "No se pudieron cargar los lotes" }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const parsed = importBatchPayloadSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Lote inválido", details: parsed.error.flatten() }, { status: 422 })
  const payload = parsed.data
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload.source_content_base64)) {
    return NextResponse.json({ error: "El original base64 no es válido" }, { status: 422 })
  }
  const original = Buffer.from(payload.source_content_base64, "base64")
  const sourceHash = createHash("sha256").update(original).digest("hex")
  if (original.byteLength > 10 * 1024 * 1024 || original.byteLength !== payload.source_bytes) {
    return NextResponse.json({ error: "El tamaño del original no coincide o supera 10 MB" }, { status: 422 })
  }
  if (sourceHash.toLowerCase() !== payload.source_sha256.toLowerCase()) {
    return NextResponse.json({ error: "El SHA-256 del original no coincide" }, { status: 422 })
  }

  const supabase = await createClient()
  const { data: existing } = await supabase.from("collection_import_batches")
    .select("id, status").eq("source_sha256", sourceHash).eq("mapping_version_id", payload.mapping_version_id).maybeSingle()
  if (existing) return NextResponse.json({ error: "El archivo ya fue cargado", batch_id: existing.id, status: existing.status }, { status: 409 })

  // El id se genera acá para poder armar la ruta del original antes de insertar.
  const batchId = randomUUID()
  const storagePath = `imports/${batchId}/original`
  const { data: batch, error } = await supabase.from("collection_import_batches").insert({
    id: batchId,
    company_id: payload.company_id,
    file_name: payload.file_name,
    source_sha256: sourceHash,
    source_content_type: payload.source_content_type || null,
    source_bytes: payload.source_bytes,
    storage_bucket: STORAGE_BUCKET,
    storage_path: storagePath,
    mapping_version_id: payload.mapping_version_id,
    uploaded_by: session.userId,
    status: "preview",
    total_rows: payload.rows.length,
    valid_rows: payload.rows.filter((row) => row.status !== "error" && !row.duplicate).length,
    error_rows: payload.rows.filter((row) => row.status === "error").length,
  }).select("*").single()
  if (error || !batch) return NextResponse.json({ error: error?.code === "23505" ? "El archivo ya fue cargado" : "No se pudo crear el lote" }, { status: error?.code === "23505" ? 409 : 500 })

  // El original queda guardado tal cual llegó: es la prueba de qué se importó.
  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET)
    .upload(storagePath, original, { contentType: payload.source_content_type || "application/octet-stream", upsert: false })
  if (uploadError) {
    await supabase.from("collection_import_batches").update({ status: "failed", original_storage_metadata: { error: "storage_upload_failed" } }).eq("id", batch.id)
    return NextResponse.json({ error: "No se pudo conservar el archivo original", batch_id: batch.id }, { status: 500 })
  }
  await supabase.from("collection_import_batches").update({
    original_storage_metadata: { bucket: STORAGE_BUCKET, path: storagePath, bytes: original.byteLength, content_type: payload.source_content_type || "application/octet-stream" },
  }).eq("id", batch.id)

  const { data: insertedRows, error: rowsError } = await supabase.from("collection_import_rows").insert(
    payload.rows.map((row) => ({
      ...rowPayload(row),
      batch_id: batch.id,
      mapping_version_id: payload.mapping_version_id,
      row_hash: createHash("sha256").update(stableJson({ mapping_version_id: payload.mapping_version_id, raw: row.raw, normalized: row.normalized, dedupe_key: row.dedupeKey })).digest("hex"),
    }))
  ).select("id, row_number, status")
  if (rowsError) {
    await supabase.from("collection_import_batches").update({ status: "failed" }).eq("id", batch.id)
    return NextResponse.json({ error: "No se pudieron guardar las filas", batch_id: batch.id }, { status: 500 })
  }
  // El cliente necesita los ids persistidos para elegir qué filas aplicar; sin
  // esto tendría que adivinarlos o releer el lote entero paginado.
  const applicableRowIds = (insertedRows || []).filter((row) => row.status === "valid" || row.status === "warning").map((row) => row.id)
  return NextResponse.json({ ...batch, rows: payload.rows.length, row_ids: applicableRowIds }, { status: 201 })
}
