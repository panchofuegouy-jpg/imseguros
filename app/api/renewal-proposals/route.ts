import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { isNextResponse, requireAdmin } from "@/lib/admin-guard"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { bseRowsSchema, itemsForClient } from "@/lib/renewal-proposals"
import { RENEWAL_PROPOSALS_BUCKET, matchBseRows } from "@/lib/renewal-proposals-server"
import { renderProposalPdf } from "@/lib/renewal-proposal-pdf"

export const runtime = "nodejs"
export const maxDuration = 60

const createSchema = z.object({
  client_id: z.string().uuid(),
  source_filename: z.string().trim().max(255).optional(),
  rows: bseRowsSchema,
})

/** Lista las propuestas de un cliente (para su ficha). */
export async function GET(request: NextRequest) {
  const session = await requireAdmin()
  if (isNextResponse(session)) return session
  const clientId = request.nextUrl.searchParams.get("client_id")
  if (!clientId || !z.string().uuid().safeParse(clientId).success) {
    return NextResponse.json({ error: "Indicá el cliente" }, { status: 422 })
  }
  const { data, error } = await (await createClient())
    .from("renewal_proposals")
    .select("id, created_at, aumento_pct, total_actual, total_propuesto, status, sent_at, source_filename, items")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) return NextResponse.json({ error: "No se pudieron cargar las propuestas" }, { status: 500 })
  return NextResponse.json({
    data: (data || []).map(({ items, ...proposal }) => ({ ...proposal, polizas: itemsForClient(items || []).length })),
  })
}

/**
 * Genera la propuesta de UN cliente: vuelve a cruzar y calcular en el servidor
 * (no confía en los números del navegador), arma el PDF, lo sube al bucket privado
 * y lo registra en la ficha. Uno por pedido para no pasar el tiempo límite.
 */
export async function POST(request: NextRequest) {
  const session = await requireAdmin()
  if (isNextResponse(session)) return session

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 422 })

  const supabase = await createClient()
  let match
  try {
    match = await matchBseRows(supabase, parsed.data.rows)
  } catch (error) {
    console.error("[renewal-proposals] match", error)
    return NextResponse.json({ error: "No se pudo cruzar el archivo con las pólizas" }, { status: 500 })
  }
  const group = match.groups.find((candidate) => candidate.client.id === parsed.data.client_id)
  if (!group) return NextResponse.json({ error: "Este cliente no tiene pólizas en el archivo" }, { status: 404 })

  const shown = itemsForClient(group.items)
  if (!shown.length) {
    return NextResponse.json({ error: "No hay pólizas con datos suficientes para armar la propuesta" }, { status: 422 })
  }

  const proposalId = randomUUID()
  const storagePath = `${group.client.id}/${proposalId}.pdf`
  let pdf: Buffer
  try {
    pdf = await renderProposalPdf({
      clientName: group.client.nombre,
      clientDocument: group.client.documento,
      generatedAt: new Date(),
      items: group.items,
    })
  } catch (error) {
    console.error("[renewal-proposals] pdf", error)
    return NextResponse.json({ error: "No se pudo armar el PDF" }, { status: 500 })
  }

  // Bucket privado: solo el servidor (service role) escribe y firma links.
  const storage = createAdminClient().storage.from(RENEWAL_PROPOSALS_BUCKET)
  const { error: uploadError } = await storage.upload(storagePath, pdf, { contentType: "application/pdf", upsert: false })
  if (uploadError) {
    console.error("[renewal-proposals] upload", uploadError)
    return NextResponse.json({ error: "No se pudo guardar el PDF" }, { status: 502 })
  }

  const { data, error } = await supabase
    .from("renewal_proposals")
    .insert({
      id: proposalId,
      client_id: group.client.id,
      source_filename: parsed.data.source_filename || null,
      aumento_pct: group.client.aumento_renovacion_pct,
      items: group.items,
      total_actual: group.totals.actual,
      total_propuesto: group.totals.propuesto,
      storage_path: storagePath,
      created_by: session.userId,
    })
    .select("id, created_at, total_actual, total_propuesto, status")
    .single()
  if (error) {
    await storage.remove([storagePath])
    console.error("[renewal-proposals] insert", error)
    return NextResponse.json({ error: "No se pudo registrar la propuesta" }, { status: 500 })
  }

  return NextResponse.json({ data: { ...data, client_id: group.client.id, polizas: shown.length } }, { status: 201 })
}
