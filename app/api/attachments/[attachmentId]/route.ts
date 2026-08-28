import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { z } from "zod"

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("share") }),
  z.object({ action: z.literal("revoke"), reason: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal("archive") }),
])

export async function GET(_request: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const { attachmentId } = await params; const supabase = await createClient()
  const { data, error } = await supabase.from("attachments")
    .select("id, claim_id, filename, mime_type, size_bytes, visibility, shared_at, revoked_at, archived_at, created_at, storage_bucket, storage_path")
    .eq("id", attachmentId).maybeSingle()
  if (error) return NextResponse.json({ error: "No se pudo cargar el adjunto" }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Adjunto no encontrado" }, { status: 404 })
  if (data.revoked_at || data.archived_at) return NextResponse.json({ error: "El adjunto no está disponible" }, { status: 410 })
  const { data: signed, error: signError } = await supabase.storage.from(data.storage_bucket).createSignedUrl(data.storage_path, 300)
  if (signError || !signed?.signedUrl) return NextResponse.json({ error: "No se pudo autorizar la descarga" }, { status: 403 })
  return NextResponse.json({ ...data, download_url: signed.signedUrl })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ attachmentId: string }> }) {
  const session = await requireAdmin(); if (isNextResponse(session)) return session
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "Operación inválida" }, { status: 422 })
  const { attachmentId } = await params; const supabase = await createClient()
  const { data: current } = await supabase.from("attachments").select("*").eq("id", attachmentId).maybeSingle()
  if (!current) return NextResponse.json({ error: "Adjunto no encontrado" }, { status: 404 })
  if (current.revoked_at && parsed.data.action !== "archive") return NextResponse.json({ error: "Un adjunto revocado no se puede reactivar" }, { status: 409 })
  const { data, error } = await supabase.rpc("transition_attachment", {
    p_attachment_id: attachmentId, p_actor_id: session.userId,
    p_action: parsed.data.action, p_reason: parsed.data.action === "revoke" ? parsed.data.reason : null,
  })
  if (error) return NextResponse.json({ error: "No se pudo actualizar el adjunto" }, { status: error.code === "42501" ? 403 : error.code === "P0002" ? 409 : 500 })
  return NextResponse.json({ resource: data })
}
