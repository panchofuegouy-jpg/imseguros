import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { createAdminClient } from "@/lib/supabase/server"
import { readPoliciesShareToken } from "@/lib/share-link"
import { formatDate } from "@/lib/format"
import { PoliciesList } from "./policies-list"

// Página pública (sin login) con las pólizas vigentes de un cliente. Se llega
// solo con el link firmado que manda el corredor por WhatsApp.

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const clientId = readPoliciesShareToken(token)
  const { data: client } = clientId
    ? await createAdminClient().from("clients").select("nombre").eq("id", clientId).single()
    : { data: null }
  // URL absoluta para la imagen de vista previa: el dominio desde donde se abre el link.
  const host = (await headers()).get("host")
  const title = client ? `Pólizas de ${client.nombre} · IM Seguros` : "Tus pólizas · IM Seguros"
  return {
    metadataBase: host ? new URL(`${host.startsWith("localhost") ? "http" : "https"}://${host}`) : undefined,
    title,
    description: "Tocá para ver y descargar los PDF de tus pólizas vigentes.",
    openGraph: { title, description: "Tocá para ver y descargar los PDF de tus pólizas vigentes.", siteName: "IM Seguros" },
    robots: { index: false, follow: false },
  }
}

export default async function SharedPoliciesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const clientId = readPoliciesShareToken(token)
  if (!clientId) notFound()

  const supabase = createAdminClient()
  const today = new Date().toISOString().slice(0, 10)
  const [{ data: client }, { data: policies }] = await Promise.all([
    supabase.from("clients").select("nombre").eq("id", clientId).single(),
    supabase
      .from("policies")
      .select("id, numero_poliza, tipo, notas, vigencia_inicio, vigencia_fin, archivo_url, archivo_urls, companies(name)")
      .eq("client_id", clientId)
      .gte("vigencia_fin", today)
      .order("numero_poliza", { ascending: false }),
  ])
  if (!client) notFound()

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar px-4 py-5 text-sidebar-foreground sm:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/nuevo-logo-isgleas-seguros.webp" alt="Isgleas Seguros" className="h-9 w-auto" />
          <p className="text-right text-xs text-sidebar-foreground/75">Paysandú, Uruguay</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
        <p className="text-sm text-muted-foreground">Pólizas vigentes de</p>
        <h1 className="font-display text-3xl font-medium">{client.nombre}</h1>

        {!policies?.length ? (
          <p className="mt-8 text-muted-foreground">No hay pólizas vigentes por ahora.</p>
        ) : (
          <PoliciesList
            policies={policies.map((p) => {
              const companies = p.companies as { name: string } | { name: string }[] | null
              return {
                id: p.id,
                numero: p.numero_poliza,
                company: (Array.isArray(companies) ? companies[0]?.name : companies?.name) ?? undefined,
                tipo: p.tipo ?? undefined,
                // Las notas cargadas desde el BSE traen «vehículo · cobertura · póliza anterior».
                detail: p.notas?.split(" · ")[0],
                vigencia: `${formatDate(p.vigencia_inicio)} al ${formatDate(p.vigencia_fin)}`,
                file: p.archivo_urls?.[0] ?? p.archivo_url ?? undefined,
              }
            })}
          />
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground">Isgleas Seguros · Consultas por WhatsApp a tu asesor</p>
      </main>
    </div>
  )
}
