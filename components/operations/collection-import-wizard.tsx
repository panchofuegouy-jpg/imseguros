"use client"

import { ChangeEvent, useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CANONICAL_IMPORT_COLUMNS, IMPORT_LIMITS, canonicalMapping, canonicalTemplateCsv, markDuplicates, normalizeRows, parseCsv, parseXlsx, type ImportMapping, type NormalizedImportRow } from "@/lib/collection-import"

type Step = "load" | "map" | "review" | "confirm" | "result"
const steps: { key: Step; label: string }[] = [{ key: "load", label: "Cargar" }, { key: "map", label: "Mapear" }, { key: "review", label: "Revisar" }, { key: "confirm", label: "Confirmar" }, { key: "result", label: "Resultado" }]

export function CollectionImportWizard() {
  const [step, setStep] = useState<Step>("load")
  const [fileName, setFileName] = useState("")
  const [sourceRows, setSourceRows] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<ImportMapping>(canonicalMapping())
  const [rows, setRows] = useState<NormalizedImportRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState(false)
  const [batchId, setBatchId] = useState("")
  const [sourceHash, setSourceHash] = useState("")
  const [sourceContentBase64, setSourceContentBase64] = useState("")
  const [sourceBytes, setSourceBytes] = useState(0)
  const [saving, setSaving] = useState(false)
  const [outcome, setOutcome] = useState<{ applied: number; errors: number } | null>(null)
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [companyId, setCompanyId] = useState("")
  const [mappingVersion, setMappingVersion] = useState(1)
  const summary = useMemo(() => ({ valid: rows.filter((row) => row.status !== "error" && !row.duplicate).length, errors: rows.filter((row) => row.status === "error").length, warnings: rows.filter((row) => row.status === "warning").length, skipped: rows.filter((row) => row.duplicate).length }), [rows])

  useEffect(() => {
    // Single-tenant: el catálogo de compañías es uno solo, sin habilitación por corredor.
    fetch("/api/companies").then((response) => response.json()).then((result) => {
      setCompanies(Array.isArray(result) ? result : result?.data || [])
    }).catch(() => setError("No se pudieron cargar las aseguradoras"))
  }, [])

  function remap(nextMapping: ImportMapping) {
    setMapping(nextMapping)
    setRows(markDuplicates(normalizeRows(sourceRows, nextMapping)))
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    if (file.size > IMPORT_LIMITS.maxBytes) { setError("El archivo supera el límite de 10 MB."); return }
    if (!/\.(csv|xlsx)$/i.test(file.name)) { setError("Elegí un archivo .csv o .xlsx."); return }
    try {
      const parsed = /\.xlsx$/i.test(file.name) ? await parseXlsx(await file.arrayBuffer()) : parseCsv(await file.text())
      if (parsed.length < 2) throw new Error("El archivo debe incluir encabezado y al menos una fila")
      if (parsed.length - 1 > IMPORT_LIMITS.maxRows) throw new Error("El archivo supera el límite de 10.000 filas")
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
      const hash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
      const nextMapping = canonicalMapping()
      const normalized = markDuplicates(normalizeRows(parsed, nextMapping))
      const id = crypto.randomUUID()
      const version = 1
      setSourceRows(parsed); setHeaders(parsed[0].map((header) => header.trim()).filter(Boolean)); setMapping(nextMapping); setMappingVersion(version)
      setSourceContentBase64(await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) }))
      // `file.size` es el tamaño real; derivarlo del largo del base64 sobrecuenta
      // el padding y el servidor rechaza el lote por tamaño que no coincide.
      setSourceBytes(file.size)
      setSourceHash(hash); setBatchId(id); setFileName(file.name); setRows(normalized); setStep("map")

    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo leer el archivo") }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([canonicalTemplateCsv()], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "plantilla-cobranza.csv"; anchor.click(); URL.revokeObjectURL(url)
  }

  function renderRows() {
    return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Fila</th><th className="p-2">Identidad</th><th className="p-2">Vencimiento</th><th className="p-2 text-right">Importe</th><th className="p-2">Estado</th><th className="p-2">Observaciones</th></tr></thead><tbody>{rows.slice(0, 50).map((row) => <tr className="border-b align-top" key={row.rowNumber}><td className="p-2">{row.rowNumber}</td><td className="p-2">{row.raw.external_reference || row.raw.policy_number || row.raw.debtor_document}</td><td className="p-2">{row.normalized.due_date || row.raw.due_date || "—"}</td><td className="p-2 text-right">{row.normalized.amount ?? row.raw.amount}</td><td className="p-2"><Badge variant={row.status === "error" ? "destructive" : row.status === "warning" ? "outline" : "secondary"}>{row.status === "error" ? "Error" : row.status === "warning" ? "Advertencia" : "Válida"}</Badge></td><td className="p-2 text-xs text-muted-foreground">{[...row.errors, ...row.warnings].map((issue) => issue.message).join(" · ") || "—"}</td></tr>)}</tbody></table>{rows.length > 50 && <p className="pt-3 text-xs text-muted-foreground">Mostrando 50 de {rows.length} filas. El lote conserva el detalle completo.</p>}</div>
  }

  /** Reusa el perfil vigente si el mapeo no cambió: una versión nueva por
   *  importación rompe la deduplicación, que se indexa por mapping_version_id. */
  async function resolveMappingVersion(): Promise<string | null> {
    const existing = await fetch(`/api/collections/mappings?company_id=${companyId}`).then((response) => response.ok ? response.json() : null).catch(() => null)
    const match = (existing?.data || []).find((profile: { id: string; mapping: ImportMapping }) => JSON.stringify(profile.mapping) === JSON.stringify(mapping))
    if (match) { setMappingVersion(existing.data[0]?.version ?? 1); return match.id }
    const created = await fetch("/api/collections/mappings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ company_id: companyId, mapping }) })
    const result = await created.json().catch(() => null)
    if (!created.ok) { setError(result?.error || "No se pudo versionar el perfil de mapeo"); return null }
    setMappingVersion(result.version ?? 1)
    return result.id
  }

  async function confirmBatch() {
    setError(null); setSaving(true)
    try {
      if (!companyId) { setError("Seleccioná la compañía del lote"); return }
      const mappingVersionId = await resolveMappingVersion()
      if (!mappingVersionId) return
      const response = await fetch("/api/collections/imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ company_id: companyId, mapping_version_id: mappingVersionId, file_name: fileName, source_sha256: sourceHash, source_content_type: /\.xlsx$/i.test(fileName) ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv", source_bytes: sourceBytes, source_content_base64: sourceContentBase64, rows }) })
      const result = await response.json().catch(() => null)
      if (!response.ok) { setError(result?.error || "No se pudo guardar el lote"); return }
      setBatchId(result.id)
      // El POST devuelve los ids persistidos de las filas aplicables; el apply
      // exige la selección explícita y nunca aplica "todo el lote" implícito.
      const rowIds: string[] = result.row_ids || []
      if (rowIds.length === 0) { setError("El lote quedó guardado pero no hay filas aplicables."); return }
      const applyResponse = await fetch(`/api/collections/imports/${result.id}/apply`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ row_ids: rowIds }) })
      const appliedResult = await applyResponse.json().catch(() => null)
      if (!applyResponse.ok) { setError(appliedResult?.error || "No se pudo aplicar el lote"); return }
      setOutcome({ applied: appliedResult?.applied ?? 0, errors: appliedResult?.errors ?? 0 })
      setApplied(true); setStep("result")
    } finally { setSaving(false) }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap gap-2" aria-label="Progreso de importación">{steps.map((item, index) => <div key={item.key} className={`rounded-full border px-3 py-1 text-sm ${steps.findIndex((current) => current.key === step) >= index ? "border-primary bg-primary/10" : "text-muted-foreground"}`}>{index + 1}. {item.label}</div>)}</div>
    {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4" />{error}</div>}
    {step === "load" && <Card><CardHeader><CardTitle>Importar cartera</CardTitle></CardHeader><CardContent className="grid gap-5"><p className="text-sm text-muted-foreground">Cargá un archivo tabular para preparar un lote. Esta pantalla no crea clientes ni envía contactos.</p><div className="flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" />Descargar plantilla canónica</Button><label className="inline-flex h-10 cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"><Upload className="mr-2 h-4 w-4" />Elegir CSV/XLSX<Input className="hidden" type="file" accept=".csv,.xlsx" onChange={readFile} /></label></div><p className="text-xs text-muted-foreground">Máximo 10 MB y 10.000 filas. XLSX se lee sin macros ni fórmulas; se sanitizan valores ejecutables.</p></CardContent></Card>}
    {step !== "load" && <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />{fileName}</CardTitle></CardHeader><CardContent className="space-y-5"><div className="grid gap-3 sm:grid-cols-4"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Filas</p><strong>{rows.length}</strong></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Aplicables</p><strong>{summary.valid}</strong></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Errores / duplicadas</p><strong>{summary.errors} / {summary.skipped}</strong></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Perfil de mapeo</p><strong>v{mappingVersion}</strong></div></div>
      {step === "map" && <><p className="text-sm">Asociá cada columna de origen al destino canónico. El perfil v{mappingVersion} queda guardado junto al lote y no se modifica retroactivamente.</p><label className="grid max-w-md gap-1 text-sm">Compañía del lote<select className="h-10 rounded-md border bg-background px-3" value={companyId} onChange={(event) => setCompanyId(event.target.value)}><option value="">Seleccionar compañía</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2">{CANONICAL_IMPORT_COLUMNS.map((column) => <label className="grid gap-1 text-sm" key={column.key}>{column.label}{column.required && " *"}<select className="h-10 rounded-md border bg-background px-3" value={mapping[column.key] || ""} onChange={(event) => remap({ ...mapping, [column.key]: event.target.value })}><option value="">Sin asignar</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><p className="break-all text-xs text-muted-foreground">Lote {batchId} · SHA-256 {sourceHash} · original privado: se conserva server-side</p><Button onClick={() => setStep("review")}>Continuar a revisión</Button></>}
      {step === "review" && <>{renderRows()}<div className="flex gap-3"><Button variant="outline" onClick={() => setStep("map")}>Volver al mapeo</Button><Button onClick={() => setStep("confirm")}>Revisar aplicación</Button></div></>}
      {step === "confirm" && <><div className="rounded-lg border p-4 text-sm"><p className="font-medium">Se aplicarán localmente {summary.valid} filas válidas.</p><p className="text-muted-foreground">{summary.errors} filas con error quedarán aisladas. Las duplicadas se omitirán por clave persistida de idempotencia. No se envían mensajes automáticamente.</p></div><div className="flex gap-3"><Button variant="outline" onClick={() => setStep("review")}>Volver</Button><Button disabled={summary.valid === 0 || saving} onClick={confirmBatch}>{saving ? "Aplicando…" : "Confirmar lote"}</Button></div></>}
      {step === "result" && <><div className="flex items-center gap-2 text-green-700"><CheckCircle2 className="h-5 w-5" />Lote aplicado.</div><p className="text-sm text-muted-foreground">{applied && outcome ? `${outcome.applied} obligaciones creadas o actualizadas; ${outcome.errors} filas con error y ${summary.skipped} duplicadas omitidas.` : "Sin aplicación."} No se crearon clientes ni se contactó a nadie.</p></>}
    </CardContent></Card>}
  </div>
}
