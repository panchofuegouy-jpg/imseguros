import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { RENEWAL_PROPOSALS_BUCKET } from "@/lib/renewal-proposals-server"
import { toWhatsAppPhone } from "@/lib/whatsapp-share"
import { firstName } from "@/lib/format"

const SHARE_DAYS = 7
const VIEW_SECONDS = 10 * 60

const bodySchema = z.object({ purpose: z.enum(["view", "share"]) })

/**
 * Devuelve un link firmado al PDF.
 * - view: para que la dueña lo abra (vence en 10 minutos).
 * - share: para mandarlo por WhatsApp (vence en 7 días); marca la propuesta como enviada.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ proposalId: string }> }) {
  const session = await requireAdmin()
  if (isNextResponse(session)) return session

  const { proposalId } = await params
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!z.string().uuid().safeParse(proposalId).success || !parsed.success) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 422 })
  }

  const supabase = await createClient()
  const { data: proposal, error } = await supabase
    .from("renewal_proposals")
    .select("id, storage_path, status, client:clients(nombre, telefono)")
    .eq("id", proposalId)
    .single()
  if (error || !proposal?.storage_path) return NextResponse.json({ error: "No encontramos esa propuesta" }, { status: 404 })

  const seconds = parsed.data.purpose === "share" ? SHARE_DAYS * 24 * 60 * 60 : VIEW_SECONDS
  const { data: signed, error: signError } = await createAdminClient()
    .storage.from(RENEWAL_PROPOSALS_BUCKET)
    .createSignedUrl(proposal.storage_path, seconds, { download: parsed.data.purpose === "share" ? "Propuesta-renovacion.pdf" : false })
  if (signError || !signed?.signedUrl) return NextResponse.json({ error: "No se pudo preparar el link" }, { status: 502 })

  if (parsed.data.purpose === "view") return NextResponse.json({ url: signed.signedUrl })

  const client = (Array.isArray(proposal.client) ? proposal.client[0] : proposal.client) as { nombre: string; telefono: string | null } | null
  const phone = toWhatsAppPhone(client?.telefono)
  if (!phone) return NextResponse.json({ error: "El cliente no tiene teléfono cargado" }, { status: 422 })

  const vence = new Date(Date.now() + seconds * 1000).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", timeZone: "America/Montevideo" })
  const message =
    `Hola ${firstName(client?.nombre)}, ¿cómo estás?\n\n` +
    `Te paso la propuesta de renovación de tus seguros con el BSE para el próximo período:\n${signed.signedUrl}\n\n` +
    `(El link está disponible hasta el ${vence}.)\n\n` +
    `Cualquier duda o cambio, respondeme por acá.\n\nSaludos, Isgleas Seguros.`

  // Se marca al abrir WhatsApp con el link (no podemos saber si después se mandó el mensaje).
  if (proposal.status === "generada") {
    const { error: updateError } = await supabase
      .from("renewal_proposals")
      .update({ status: "enviada", sent_at: new Date().toISOString() })
      .eq("id", proposal.id)
    if (updateError) console.error("[renewal-proposals/link] status", updateError.code)
  }

  return NextResponse.json({ url: signed.signedUrl, whatsapp_url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}` })
}
