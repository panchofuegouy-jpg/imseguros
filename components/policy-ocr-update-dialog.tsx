"use client"

import { useState } from "react"
import { FileUp, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { normalizeOcrDate } from "@/lib/ocr-date"
import { parseOcrData } from "@/lib/parse-ocr-data"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Company {
  id: string
  name: string
}

interface UpdatablePolicy {
  id: string
  client_id: string
  company_id: string | null
  numero_poliza: string
  tipo: string
  vigencia_inicio: string
  vigencia_fin: string
  archivo_url: string | null
  archivo_urls: string[] | null
  notas: string | null
  nombre_asegurado?: string | null
  documento_asegurado?: string | null
  parentesco?: string | null
  prima_monto: number | null
  moneda: string | null
  forma_pago: string | null
  numero_factura: string | null
}

interface PolicyOcrUpdateDialogProps {
  policy: UpdatablePolicy
  companies: Company[]
  onSuccess: () => void
}

interface UpdateDraft {
  numero_poliza: string
  company_id: string
  tipo: string
  vigencia_inicio: string
  vigencia_fin: string
  nueva_prima: string
  moneda: string
  forma_pago: string
  numero_factura: string
  nombre_asegurado: string
  documento_asegurado: string
  parentesco: string
  notas: string
}

const parseAmount = (value: unknown): number => {
  if (value === null || value === undefined || value === "") return 0
  const cleaned = String(value).replace(/[^\d.,-]/g, "")
  const lastComma = cleaned.lastIndexOf(",")
  const lastDot = cleaned.lastIndexOf(".")
  const normalized = lastComma > lastDot
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned.replace(/,/g, "")
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function PolicyOcrUpdateDialog({ policy, companies, onSuccess }: PolicyOcrUpdateDialogProps) {
  const [open, setOpen] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fileName, setFileName] = useState("")
  const [storedPath, setStoredPath] = useState("")
  const [documentUrl, setDocumentUrl] = useState("")
  const [draft, setDraft] = useState<UpdateDraft | null>(null)
  const supabase = createClient()

  const previousPremium = Number(policy.prima_monto || 0)
  const newPremium = parseAmount(draft?.nueva_prima)
  const updatedPremium = previousPremium + newPremium

  const matchCompany = (extracted: any) => {
    const raw = extracted.company_id ?? extracted.aseguradora ?? extracted.compania ?? extracted.company ?? extracted.name
    if (!raw) return policy.company_id || ""
    const rawStr = String(raw).trim().toLowerCase()

    // First try exact ID match
    if (companies.find(c => c.id === raw)) return raw

    // Then try name match (case-insensitive)
    const matched = companies.find((company) =>
      company.name.toLowerCase() === rawStr
    )
    if (matched) return matched.id

    // Try partial match as fallback
    const partial = companies.find((company) =>
      rawStr.includes(company.name.toLowerCase()) || company.name.toLowerCase().includes(rawStr)
    )
    if (partial) return partial.id

    // Default to existing company
    return policy.company_id || ""
  }

  const cleanupPendingUpload = async () => {
    if (!storedPath) return
    await supabase.storage.from("policy-documents").remove([storedPath])
  }

  const reset = () => {
    setDraft(null)
    setFileName("")
    setStoredPath("")
    setDocumentUrl("")
    setAnalyzing(false)
    setSaving(false)
  }

  const handleOpenChange = async (nextOpen: boolean) => {
    if (!nextOpen && !saving && storedPath) await cleanupPendingUpload()
    if (!nextOpen) reset()
    setOpen(nextOpen)
  }

  const handleAnalyze = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Seleccioná un archivo PDF, PNG o JPG")
      return
    }

    setAnalyzing(true)
    setDraft(null)
    setFileName(file.name)

    let uploadedPath = ""
    try {
      const extension = file.name.split(".").pop()
      const filePath = `${policy.client_id}/update-${policy.id}-${Date.now()}.${extension}`
      const { data, error } = await supabase.storage
        .from("policy-documents")
        .upload(filePath, file, { cacheControl: "3600", upsert: false })
      if (error) throw error

      uploadedPath = data?.path || filePath
      setStoredPath(uploadedPath)
      setDocumentUrl(
        supabase.storage.from("policy-documents").getPublicUrl(uploadedPath).data.publicUrl
      )

      const formData = new FormData()
      formData.append("file", file)
      formData.append("filePath", uploadedPath)
      formData.append("clientId", policy.client_id)
      formData.append("fileName", file.name)
      formData.append("analysisContext", "actualizacion_de_poliza")
      formData.append("expectedFields", JSON.stringify([
        "numero_poliza",
        "aseguradora",
        "tipo",
        "vigencia_inicio",
        "vigencia_fin",
        "total_a_pagar",
        "moneda",
        "forma_pago",
        "numero_factura",
        "nombre_asegurado",
        "documento_asegurado",
        "parentesco",
        "notas",
      ]))

      const response = await fetch("/api/ocr-webhook", { method: "POST", body: formData })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || "No se pudo analizar el documento")
      }

      const responseData = await response.json()
      const extracted = parseOcrData(responseData)

      console.log('OCR Update Dialog - extraction result:', {
        responseKeys: Object.keys(responseData).slice(0, 5),
        extractedKeys: Object.keys(extracted),
        hasNumeroPoliza: !!extracted.numero_poliza,
        hasTipo: !!extracted.tipo,
        hasVigencia: !!extracted.vigencia_inicio && !!extracted.vigencia_fin,
        extracted,
      })

      if (!extracted || typeof extracted !== "object" || !Object.keys(extracted).length) {
        throw new Error("No se pudieron extraer datos del documento. Verificá que sea una póliza válida.")
      }

      const premiumValue =
        extracted.diferencia ??
        extracted.diferencia_a_pagar ??
        extracted.total_a_pagar ??
        extracted.prima_monto ??
        extracted.prima ??
        extracted.monto ??
        extracted.importe ??
        extracted.premio

      setDraft({
        numero_poliza: String(extracted.numero_poliza || policy.numero_poliza || ""),
        company_id: matchCompany(extracted),
        tipo: String(extracted.tipo || policy.tipo || ""),
        vigencia_inicio: normalizeOcrDate(extracted.vigencia_inicio, policy.vigencia_inicio),
        vigencia_fin: normalizeOcrDate(extracted.vigencia_fin, policy.vigencia_fin),
        nueva_prima: premiumValue != null ? String(premiumValue) : "",
        moneda: String(extracted.moneda || policy.moneda || "UYU"),
        forma_pago: String(extracted.forma_pago ?? extracted.frecuencia_pago ?? policy.forma_pago ?? ""),
        numero_factura: String(extracted.numero_factura ?? extracted.factura ?? policy.numero_factura ?? ""),
        nombre_asegurado: String(extracted.nombre_asegurado ?? policy.nombre_asegurado ?? ""),
        documento_asegurado: String(extracted.documento_asegurado ?? policy.documento_asegurado ?? ""),
        parentesco: String(extracted.parentesco ?? policy.parentesco ?? "Titular"),
        notas: String(extracted.notas ?? policy.notas ?? ""),
      })
      toast.success("Documento analizado. Revisá los datos antes de actualizar.")
    } catch (error) {
      if (uploadedPath) await supabase.storage.from("policy-documents").remove([uploadedPath])
      setStoredPath("")
      setDocumentUrl("")
      setFileName("")
      toast.error(error instanceof Error ? error.message : "No se pudo analizar la póliza")
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!draft || !storedPath || !documentUrl) return
    setSaving(true)

    try {
      const previousFiles = policy.archivo_urls?.length
        ? policy.archivo_urls
        : policy.archivo_url
          ? [policy.archivo_url]
          : []
      if (
        previousPremium > 0 &&
        policy.moneda &&
        draft.moneda &&
        policy.moneda !== draft.moneda
      ) {
        throw new Error(`No se pueden sumar primas en ${policy.moneda} y ${draft.moneda}`)
      }

      const archivoUrls = Array.from(new Set([...previousFiles, documentUrl]))
      const response = await fetch(`/api/policies/${policy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero_poliza: draft.numero_poliza,
          company_id: draft.company_id || null,
          tipo: draft.tipo,
          vigencia_inicio: draft.vigencia_inicio,
          vigencia_fin: draft.vigencia_fin,
          prima_monto: updatedPremium,
          moneda: draft.moneda || policy.moneda || "UYU",
          forma_pago: draft.forma_pago || null,
          numero_factura: draft.numero_factura || null,
          nombre_asegurado: draft.nombre_asegurado || null,
          documento_asegurado: draft.documento_asegurado || null,
          parentesco: draft.parentesco || "Titular",
          archivo_urls: archivoUrls,
          archivo_url: documentUrl,
          notas: draft.notas || null,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error || "No se pudo actualizar la póliza")
      }

      setStoredPath("")
      setDocumentUrl("")
      toast.success("Póliza actualizada. Se conservaron ambos documentos.")
      setOpen(false)
      reset()
      onSuccess()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la póliza")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 border-primary/50 text-primary hover:bg-primary/15"
          title="Actualizar póliza con OCR"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] gap-3 overflow-hidden p-4 sm:max-w-[980px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Actualizar Póliza {policy.numero_poliza}
          </DialogTitle>
          <DialogDescription>
            Analizá el nuevo documento, sumá su prima y conservá el historial de archivos.
          </DialogDescription>
        </DialogHeader>

        {!draft ? (
          <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-6 text-center hover:bg-primary/10">
            {analyzing ? (
              <>
                <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
                <span className="font-semibold">Analizando la nueva póliza...</span>
              </>
            ) : (
              <>
                <FileUp className="mb-3 h-8 w-8 text-primary" />
                <span className="font-semibold">Seleccionar nueva póliza</span>
                <span className="mt-1 text-xs text-muted-foreground">PDF, PNG o JPG</span>
              </>
            )}
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="sr-only"
              disabled={analyzing}
              onChange={handleAnalyze}
            />
          </label>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 rounded-xl border border-border bg-black/10 p-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label>Póliza</Label>
                <Input className="h-9" value={draft.numero_poliza} onChange={(event) => setDraft({ ...draft, numero_poliza: event.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Input className="h-9" value={draft.tipo} onChange={(event) => setDraft({ ...draft, tipo: event.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Aseguradora</Label>
                <Select value={draft.company_id} onValueChange={(value) => setDraft({ ...draft, company_id: value })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Inicio</Label>
                <Input type="date" className="h-9" value={draft.vigencia_inicio} onChange={(event) => setDraft({ ...draft, vigencia_inicio: event.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Fin</Label>
                <Input type="date" className="h-9" value={draft.vigencia_fin} onChange={(event) => setDraft({ ...draft, vigencia_fin: event.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Prima nueva</Label>
                <Input className="h-9" value={draft.nueva_prima} onChange={(event) => setDraft({ ...draft, nueva_prima: event.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Moneda</Label>
                <Select value={draft.moneda} onValueChange={(value) => setDraft({ ...draft, moneda: value })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UYU">UYU</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2 rounded-xl border border-border bg-black/10 p-3 sm:grid-cols-4">
              <div className="space-y-1 sm:col-span-2">
                <Label>Nombre del asegurado</Label>
                <Input className="h-9" value={draft.nombre_asegurado} onChange={(event) => setDraft({ ...draft, nombre_asegurado: event.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Documento</Label>
                <Input className="h-9" value={draft.documento_asegurado} onChange={(event) => setDraft({ ...draft, documento_asegurado: event.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Parentesco</Label>
                <Input className="h-9" value={draft.parentesco} onChange={(event) => setDraft({ ...draft, parentesco: event.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Forma de pago</Label>
                <Input className="h-9" value={draft.forma_pago} onChange={(event) => setDraft({ ...draft, forma_pago: event.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Factura / recibo</Label>
                <Input className="h-9" value={draft.numero_factura} onChange={(event) => setDraft({ ...draft, numero_factura: event.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Notas</Label>
                <Input className="h-9" value={draft.notas} onChange={(event) => setDraft({ ...draft, notas: event.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-center">
              <div><p className="text-[10px] uppercase text-muted-foreground">Prima anterior</p><p className="font-bold">{previousPremium.toLocaleString("es-UY")}</p></div>
              <span className="text-xl text-muted-foreground">+</span>
              <div><p className="text-[10px] uppercase text-muted-foreground">Prima nueva</p><p className="font-bold">{newPremium.toLocaleString("es-UY")}</p></div>
              <span className="text-xl text-muted-foreground">=</span>
              <div><p className="text-[10px] uppercase text-muted-foreground">Prima actualizada</p><p className="font-bold text-primary">{updatedPremium.toLocaleString("es-UY")}</p></div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-xs">
              <span className="truncate"><strong>Nuevo archivo:</strong> {fileName}</span>
              <span className="whitespace-nowrap text-primary">
                {(policy.archivo_urls?.length || (policy.archivo_url ? 1 : 0)) + 1} documentos guardados
              </span>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !draft.nueva_prima}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar actualización
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
