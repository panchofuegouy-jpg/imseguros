"use client"

import { ChangeEvent, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, FileSpreadsheet, FileText, Loader2, PhoneOff, Upload, Users, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { SectionCard } from "@/components/brand/section-card"
import { StatCard } from "@/components/brand/stat-card"
import { StatusBadge } from "@/components/brand/status-badge"
import { formatMoney } from "@/lib/format"
import { itemsForClient, parseBseSheet, type BseRow, type ProposalItem } from "@/lib/renewal-proposals"

type ClientGroup = {
  client: { id: string; nombre: string; documento: string | null; telefono: string | null; aumento_renovacion_pct: number }
  items: (ProposalItem & { policy_id: string; tipo: string | null })[]
  totals: { actual: number; propuesto: number; variacion_pct: number | null }
}
type Preview = { groups: ClientGroup[]; unmatched: { cliente_bse: string; polizas: string[]; cotizaciones: number }[]; conflicts: string[]; duplicated: number }
type Result = { ok: true; proposalId: string } | { ok: false; error: string }

const MAX_BYTES = 10 * 1024 * 1024
const pct = (value: number | null) => (value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")} %`)

async function readBseFile(file: File) {
  const XLSX = await import("xlsx")
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error("El archivo no tiene hojas.")
  return parseBseSheet(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" }))
}

export function RenewalProposalsWizard() {
  const [fileName, setFileName] = useState("")
  const [rows, setRows] = useState<BseRow[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [done, setDone] = useState(0)
  const [results, setResults] = useState<Record<string, Result>>({})

  const stats = useMemo(() => {
    if (!preview) return null
    const matchedPolicies = preview.groups.reduce((sum, group) => sum + group.items.length, 0)
    const unmatchedPolicies = preview.unmatched.reduce((sum, group) => sum + group.cotizaciones, 0)
    return { clients: preview.groups.length, matchedPolicies, unmatchedPolicies }
  }, [preview])

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setError(null); setPreview(null); setResults({}); setDone(0)
    if (file.size > MAX_BYTES) { setError("El archivo supera los 10 MB."); return }
    if (!/\.(xls|xlsx)$/i.test(file.name)) { setError("Elegí el Excel que baja de BSE (.xls o .xlsx)."); return }
    setLoading(true)
    try {
      const { rows: parsed, skipped: skippedRows } = await readBseFile(file)
      const response = await fetch("/api/renewal-proposals/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsed }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "No se pudo leer el archivo")
      setFileName(file.name)
      setRows(parsed)
      setSkipped(skippedRows)
      setPreview(result)
      setSelected(new Set((result as Preview).groups.filter((group) => itemsForClient(group.items).length > 0).map((group) => group.client.id)))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer el archivo")
    } finally {
      setLoading(false)
    }
  }

  function toggle(clientId: string, value: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (value) next.add(clientId); else next.delete(clientId)
      return next
    })
  }

  async function generate() {
    if (!preview) return
    const targets = preview.groups.filter((group) => selected.has(group.client.id) && !(results[group.client.id]?.ok))
    if (!targets.length) return
    setGenerating(true); setDone(0)
    let okCount = 0
    for (const group of targets) {
      const cotizaciones = new Set(group.items.map((item) => item.numero_cotizacion))
      try {
        const response = await fetch("/api/renewal-proposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: group.client.id, source_filename: fileName, rows: rows.filter((row) => cotizaciones.has(row.cotizacion)) }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || "No se pudo generar")
        okCount += 1
        setResults((current) => ({ ...current, [group.client.id]: { ok: true, proposalId: result.data.id } }))
      } catch (cause) {
        setResults((current) => ({ ...current, [group.client.id]: { ok: false, error: cause instanceof Error ? cause.message : "No se pudo generar" } }))
      }
      setDone((value) => value + 1)
    }
    setGenerating(false)
    if (okCount === targets.length) toast.success(`Listo: ${okCount} ${okCount === 1 ? "propuesta guardada" : "propuestas guardadas"} en la ficha de cada cliente.`)
    else toast.error(`Se guardaron ${okCount} de ${targets.length}. Revisá las que tienen error.`)
  }

  const pending = preview ? preview.groups.filter((group) => selected.has(group.client.id) && !(results[group.client.id]?.ok)).length : 0
  const targetsTotal = preview ? preview.groups.filter((group) => selected.has(group.client.id)).length : 0

  return (
    <div className="space-y-6">
      <SectionCard
        title="1. Subí el Excel de BSE"
        description="En el Portal del Asesor: Cotizaciones › Consulta de cotizaciones › «Exportar resultados a Excel». Bajalo antes de editar cotizaciones en BSE."
      >
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-input bg-background/40 px-6 py-10 text-center hover:border-primary">
          {loading ? <Loader2 className="size-8 animate-spin text-primary" aria-hidden /> : <FileSpreadsheet className="size-8 text-primary" aria-hidden />}
          <span className="text-lg font-semibold">{loading ? "Leyendo el archivo…" : fileName ? `Archivo: ${fileName}` : "Elegí el archivo .xls de BSE"}</span>
          <span className="text-sm text-muted-foreground">No cambia nada en BSE ni en las pólizas. Solo arma las propuestas.</span>
          <Input type="file" accept=".xls,.xlsx" className="sr-only" onChange={onFile} disabled={loading || generating} />
          <span className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground"><Upload className="size-5" aria-hidden />{fileName ? "Elegir otro archivo" : "Elegir archivo"}</span>
        </label>
        {preview && (skipped > 0 || preview.duplicated > 0) && (
          <p className="mt-3 text-base text-muted-foreground">
            {skipped > 0 && `Salteamos ${skipped} ${skipped === 1 ? "fila" : "filas"} con datos ilegibles. `}
            {preview.duplicated > 0 && `${preview.duplicated} ${preview.duplicated === 1 ? "póliza tenía" : "pólizas tenían"} más de una cotización: usamos la más nueva.`}
          </p>
        )}
        {error && <p role="alert" className="mt-3 flex items-center gap-2 text-base text-danger-strong"><AlertTriangle className="size-5" aria-hidden />{error}</p>}
      </SectionCard>

      {preview && stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Clientes encontrados" value={stats.clients} hint="Con pólizas del Excel en la plataforma" icon={Users} tone="success" />
            <StatCard label="Pólizas que cruzan" value={stats.matchedPolicies} hint="Mismo número de póliza en la plataforma" icon={CheckCircle2} />
            <StatCard label="Pólizas sin cliente" value={stats.unmatchedPolicies} hint="Están en BSE pero no en la plataforma" icon={AlertTriangle} tone={stats.unmatchedPolicies ? "warning" : "neutral"} />
          </div>

          <SectionCard
            title="2. Revisá cada cliente"
            description="Cada cliente usa su propio aumento (se cambia en su ficha). Destildá los que no quieras generar todavía."
          >
            {preview.groups.length === 0 ? (
              <p className="text-base text-muted-foreground">Ninguna póliza del Excel está cargada en la plataforma.</p>
            ) : (
              <ul className="divide-y divide-border">
                {preview.groups.map((group) => {
                  const shown = itemsForClient(group.items).length
                  const noAlcanza = group.items.filter((item) => item.estado === "no_alcanza").length
                  const revisar = group.items.filter((item) => item.estado === "revisar").length
                  const sinDatos = group.items.filter((item) => item.estado === "sin_datos").length
                  const result = results[group.client.id]
                  const id = `sel-${group.client.id}`
                  return (
                    <li key={group.client.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <Checkbox id={id} className="mt-1 size-5" checked={selected.has(group.client.id)} disabled={!shown || generating || result?.ok}
                          onCheckedChange={(value) => toggle(group.client.id, value === true)} aria-label={`Generar propuesta para ${group.client.nombre}`} />
                        <div className="min-w-0 space-y-1">
                          <label htmlFor={id} className="block cursor-pointer text-lg font-semibold">{group.client.nombre}</label>
                          <p className="text-sm text-muted-foreground">
                            Aumento {group.client.aumento_renovacion_pct} % · {shown} de {group.items.length} {group.items.length === 1 ? "póliza" : "pólizas"} en la propuesta ·{" "}
                            <Link href={`/admin/clientes/${group.client.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">Ver ficha</Link>
                          </p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {noAlcanza > 0 && <StatusBadge tone="info">{noAlcanza} con la cotización de BSE</StatusBadge>}
                            {revisar > 0 && <StatusBadge tone="warning" icon={AlertTriangle}>{revisar} para revisar a mano</StatusBadge>}
                            {sinDatos > 0 && <StatusBadge tone="neutral">{sinDatos} sin datos</StatusBadge>}
                            {!group.client.telefono && <StatusBadge tone="warning" icon={PhoneOff}>Sin teléfono</StatusBadge>}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-right lg:w-[26rem]">
                        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Paga hoy</p><p className="text-base font-semibold tabular-nums">{formatMoney(group.totals.actual)}</p></div>
                        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Propuesta</p><p className="text-base font-semibold tabular-nums">{formatMoney(group.totals.propuesto)}</p></div>
                        <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Cambio</p><p className="text-base font-semibold tabular-nums">{pct(group.totals.variacion_pct)}</p></div>
                      </div>
                      <div className="lg:w-44 lg:text-right">
                        {result?.ok && <StatusBadge tone="success" icon={CheckCircle2}>Guardada en la ficha</StatusBadge>}
                        {result && !result.ok && <StatusBadge tone="danger" icon={XCircle} className="whitespace-normal">{result.error}</StatusBadge>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="3. Generá las propuestas" description="Se arma un PDF con la marca para cada cliente y queda en su ficha, listo para mandar por WhatsApp.">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button className="h-12 text-base" onClick={generate} disabled={generating || pending === 0}>
                {generating ? <Loader2 className="animate-spin" aria-hidden /> : <FileText aria-hidden />}
                {generating ? "Generando…" : pending ? `Generar ${pending} ${pending === 1 ? "propuesta" : "propuestas"}` : "No hay propuestas pendientes"}
              </Button>
              {(generating || done > 0) && (
                <div className="flex-1 space-y-1">
                  <Progress value={targetsTotal ? (Object.values(results).length / targetsTotal) * 100 : 0} />
                  <p className="text-sm text-muted-foreground">{Object.values(results).filter((result) => result.ok).length} guardadas de {targetsTotal}</p>
                </div>
              )}
            </div>
          </SectionCard>

          {preview.unmatched.length > 0 && (
            <SectionCard
              title="Pólizas que no están en la plataforma"
              description="Están en el Excel de BSE pero no encontramos ese número de póliza. Cargalas en la ficha del cliente y volvé a subir el Excel."
            >
              <ul className="grid gap-2 sm:grid-cols-2">
                {preview.unmatched.map((group) => (
                  <li key={group.cliente_bse} className="rounded-lg border border-border bg-background/40 px-3 py-2">
                    <p className="font-semibold">{group.cliente_bse}</p>
                    <p className="text-sm text-muted-foreground">
                      {group.cotizaciones} {group.cotizaciones === 1 ? "cotización" : "cotizaciones"}
                      {group.polizas.length ? ` · pólizas ${group.polizas.slice(0, 6).join(", ")}${group.polizas.length > 6 ? "…" : ""}` : " · sin número de póliza (nuevas)"}
                    </p>
                  </li>
                ))}
              </ul>
              {preview.conflicts.length > 0 && (
                <p className="mt-3 text-sm text-warning-strong">
                  Estas pólizas están cargadas en más de un cliente y no se usaron: {preview.conflicts.join(", ")}.
                </p>
              )}
            </SectionCard>
          )}
        </>
      )}
    </div>
  )
}
