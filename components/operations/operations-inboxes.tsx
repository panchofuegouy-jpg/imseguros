"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreateClaimDialog } from "@/components/operations/create-claim-dialog"

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  reported: "Denunciado",
  in_review: "En revisión",
  submitted: "Presentado",
  awaiting_insurer: "Esperando aseguradora",
  resolved: "Resuelto",
  closed: "Cerrado",
  reopened: "Reabierto",
  archived: "Archivado",
}
const PRIORITY_LABELS: Record<string, string> = { low: "Baja", normal: "Normal", high: "Alta", urgent: "Urgente" }
const CLOSED_STATUSES = ["closed", "archived"]

export function ClaimsInbox({ basePath }: { basePath: string }) {
  const [claims, setClaims] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    return fetch("/api/claims?limit=100")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("carga"))))
      .then((payload) => setClaims(payload.data || []))
      .catch(() => setError("No se pudieron cargar los siniestros. Reintentá."))
  }, [])

  useEffect(() => { void load() }, [load])

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <p role="alert">{error}</p>
          <Button onClick={() => void load()}>Reintentar</Button>
        </CardContent>
      </Card>
    )
  }
  if (!claims) return <Card><CardContent className="p-6" aria-live="polite">Cargando siniestros…</CardContent></Card>

  const abiertos = claims.filter((claim) => !CLOSED_STATUSES.includes(claim.status))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline">{abiertos.length} abiertos</Badge>
        <div className="ml-auto">
          <CreateClaimDialog basePath={basePath} onCreated={() => void load()} />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Siniestros ({claims.length})</CardTitle></CardHeader>
        <CardContent>
          {claims.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-muted-foreground">Todavía no hay siniestros.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Se crean desde una póliza: buscá la póliza afectada y registrá la denuncia.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-3">Siniestro</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Póliza</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Prioridad</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr key={claim.id} className="border-b">
                      <td className="p-3">
                        <Link className="font-medium underline" href={`${basePath}/siniestros/${claim.id}`}>
                          {claim.external_number || claim.claim_type}
                        </Link>
                        {claim.occurrence_date && (
                          <div className="text-xs text-muted-foreground">{claim.occurrence_date}</div>
                        )}
                      </td>
                      <td className="p-3">{claim.clients?.nombre || "—"}</td>
                      <td className="p-3">
                        {claim.policies?.numero_poliza || "—"}
                        <div className="text-xs text-muted-foreground">{claim.policies?.companies?.name || ""}</div>
                      </td>
                      <td className="p-3">
                        <Badge variant={CLOSED_STATUSES.includes(claim.status) ? "secondary" : "outline"}>
                          {STATUS_LABELS[claim.status] || claim.status}
                        </Badge>
                      </td>
                      <td className="p-3">{PRIORITY_LABELS[claim.priority] || claim.priority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
