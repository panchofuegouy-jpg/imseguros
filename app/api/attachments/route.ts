import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { z } from "zod"
import { randomUUID } from "node:crypto"

/** Se reusa el bucket de pólizas; los adjuntos de siniestro viven en claims/. */
const STORAGE_BUCKET = "policy-documents"

const inputSchema = z.object({
  claim_id: z.string().uuid(),
  filename: z.string().trim().min(1).max(255),
  mime_type: z.string().trim().min(1).max(120),
  size_bytes: z.number().int().nonnegative().max(50_000_000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
})

export async function GET(request: NextRequest) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const claimId = request.nextUrl.searchParams.get("claim_id")
  if (!claimId) return NextResponse.json({ error: "Indicá el siniestro" }, { status: 422 })
  const { data, error } = await (await createClient()).from("attachments")
    .select("id, filename, mime_type, size_bytes, visibility, revoked_at, archived_at, created_at")
    .eq("claim_id", claimId).order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: "No se pudieron cargar los adjuntos" }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const parsed = inputSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Adjunto inválido", details: parsed.error.flatten() }, { status: 422 })
  const supabase = await createClient()
  const attachmentId = randomUUID()
  const safeName = parsed.data.filename.replace(/[^a-zA-Z0-9._-]+/g, "-")
  const storagePath = `claims/${parsed.data.claim_id}/${attachmentId}/${safeName}`
  const { data, error } = await supabase.from("attachments").insert({
    id: attachmentId, ...parsed.data, uploaded_by: session.userId,
    storage_bucket: STORAGE_BUCKET, storage_path: storagePath, visibility: "internal",
  }).select("id, storage_bucket, storage_path").single()
  if (error) return NextResponse.json({ error: "No se pudo registrar el adjunto" }, { status: error.code === "23514" ? 422 : 500 })
  const { data: upload, error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).createSignedUploadUrl(storagePath)
  if (uploadError || !upload?.signedUrl) {
    await supabase.from("attachments").delete().eq("id", attachmentId)
    return NextResponse.json({ error: "No se pudo preparar la carga del adjunto" }, { status: 502 })
  }
  return NextResponse.json({ attachment_id: data.id, storage_bucket: data.storage_bucket, storage_path: data.storage_path, upload_url: upload.signedUrl }, { status: 201 })
}
