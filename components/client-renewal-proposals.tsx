"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { FileText, MessageCircle, Percent, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { SectionCard } from "@/components/brand/section-card"
import { formatDate, formatMoney } from "@/lib/format"

type Proposal = {
  id: string
  created_at: string
  aumento_pct: number
  total_actual: number
  total_propuesto: number
  status: "generada" | "enviada" | "aprobada" | "rechazada" | "aplicada"
  sent_at: string | null
  polizas: number
}

const STATUS_LABEL: Record<Proposal["status"], string> = {
  generada: "Lista para enviar",
  enviada: "Enviada",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  aplicada: "Aplicada en BSE",
}

/** Abre una pestaña en el mismo clic (si no, el navegador la bloquea) y después le pone la URL. */
async function openFromApi(proposalId: string, purpose: "view" | "share") {
  const tab = window.open("about:blank", "_blank")
  try {
    const response = await fetch(`/api/renewal-proposals/${proposalId}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || "No se pudo abrir la propuesta")
    const target = purpose === "share" ? result.whatsapp_url : result.url
    if (tab) { tab.opener = null; tab.location.href = target }
    else window.location.href = target
    return true
  } catch (error) {
    tab?.close()
    toast.error(error instanceof Error ? error.message : "No se pudo abrir la propuesta")
    return false
  }
}

export function ClientRenewalProposals({ clientId, aumentoPct, hasPhone }: { clientId: string; aumentoPct: number | null; hasPhone: boolean }) {
  const [proposals, setProposals] = useState<Proposal[] | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    try {
      const response = await fetch(`/api/renewal-proposals?client_id=${clientId}`)
      const result = await response.json()
      if (!response.ok) throw new Error()
      setProposals(result.data || [])
    } catch {
      setError(true)
      setProposals([])
    }
  }, [clientId])

  useEffect(() => { load() }, [load])

  async function share(proposal: Proposal) {
    const ok = await openFromApi(proposal.id, "share")
    if (ok) load()
  }

  return (
    <SectionCard
      title="Propuestas de renovación"
      description={`Aumento en renovación de este cliente: ${aumentoPct ?? 3} %. Se cambia con «Editar cliente».`}
    >
      {proposals === null ? (
        <p className="text-sm text-muted-foreground">Cargando propuestas…</p>
      ) : error ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          No pudimos cargar las propuestas.
          <Button variant="outline" size="sm" onClick={load}><RefreshCw aria-hidden />Probar de nuevo</Button>
        </div>
      ) : proposals.length === 0 ? (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Todavía no hay propuestas para este cliente.</p>
          <Button asChild variant="outline"><Link href="/admin/polizas/propuestas"><Percent aria-hidden />Armar propuestas desde el Excel de BSE</Link></Button>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {proposals.map((proposal) => (
            <li key={proposal.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-lg font-semibold">
                  {formatMoney(proposal.total_actual)} → {formatMoney(proposal.total_propuesto)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(proposal.created_at.slice(0, 10))} · {proposal.polizas} {proposal.polizas === 1 ? "póliza" : "pólizas"} · aumento {proposal.aumento_pct} % ·{" "}
                  <span className="font-semibold text-foreground">{STATUS_LABEL[proposal.status]}</span>
                  {proposal.sent_at ? ` el ${formatDate(proposal.sent_at.slice(0, 10))}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="h-11" onClick={() => openFromApi(proposal.id, "view")}>
                  <FileText aria-hidden />Ver PDF
                </Button>
                <Button className="h-11" onClick={() => share(proposal)} disabled={!hasPhone} title={hasPhone ? undefined : "Cargá el teléfono del cliente para enviarla"}>
                  <MessageCircle aria-hidden />{proposal.sent_at ? "Reenviar por WhatsApp" : "Enviar por WhatsApp"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {proposals !== null && !hasPhone && proposals.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">Para enviarla por WhatsApp, cargá el teléfono del cliente.</p>
      )}
    </SectionCard>
  )
}
