"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { Paperclip, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador", reported: "Denunciado", in_review: "En revisión", submitted: "Presentado",
  awaiting_insurer: "Esperando aseguradora", resolved: "Resuelto", closed: "Cerrado",
  reopened: "Reabierto", archived: "Archivado",
}
/** Transiciones válidas, en el mismo orden que la máquina de estados del SQL. */
const NEXT_STATUSES: Record<string, string[]> = {
  draft: ["reported", "archived"],
  reported: ["in_review", "archived"],
  in_review: ["submitted", "resolved", "archived"],
  submitted: ["awaiting_insurer", "resolved", "archived"],
  awaiting_insurer: ["resolved", "reopened", "archived"],
  resolved: ["closed", "reopened", "archived"],
  closed: ["reopened", "archived"],
  reopened: ["in_review", "resolved", "archived"],
  archived: [],
}
const NEEDS_REASON = ["resolved", "closed", "reopened", "archived"]
const EVENT_LABELS: Record<string, string> = {
  note_added: "Nota interna", status_changed: "Cambio de estado", reported: "Denunciado",
  resolved: "Resuelto", closed: "Cerrado", reopened: "Reabierto", archived: "Archivado",
}
const MAX_UPLOAD = 20 * 1024 * 1024

type Claim = {
  id: string; status: string; priority?: string; external_number?: string; claim_type?: string
  description?: string | null; occurrence_date?: string | null; claim_events?: any[]
  policies?: { id: string; numero_poliza: string; companies?: { name: string } | null } | null
  clients?: { id: string; nombre: string } | null
}

async function sha256Hex(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function OperationDetail({ id, basePath }: { id: string; basePath: string }) {
  const [claim, setClaim] = useState<Claim | null>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [attachments, setAttachments] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [nextStatus, setNextStatus] = useState("")
  const [reason, setReason] = useState("")
  const [note, setNote] = useState("")
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDue, setTaskDue] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const [claimResponse, tasksResponse, filesResponse] = await Promise.all([
      fetch(`/api/claims/${id}`),
      fetch(`/api/claims/${id}/tasks`),
      fetch(`/api/attachments?claim_id=${id}`),
    ])
    if (!claimResponse.ok) throw new Error("No se pudo cargar el siniestro")
    setClaim(await claimResponse.json())
    setTasks(tasksResponse.ok ? (await tasksResponse.json()).data || [] : [])
    setAttachments(filesResponse.ok ? (await filesResponse.json()).data || [] : [])
  }, [id])

  useEffect(() => { load().catch(() => setError("No se pudo cargar el siniestro.")) }, [load])

  async function send(url: string, body: unknown, okMessage: string, method = "POST") {
    setBusy(true); setError(null); setSuccess(null)
    const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    setBusy(false)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error || "No se pudo completar la acción.")
      return false
    }
    setSuccess(okMessage)
    await load()
    return true
  }

  async function changeStatus() {
    if (!nextStatus) return
    if (NEEDS_REASON.includes(nextStatus) && !reason.trim()) {
      setError(`Para pasar a "${STATUS_LABELS[nextStatus]}" hace falta un motivo.`)
      return
    }
    if (await send(`/api/claims/${id}`, { status: nextStatus, reason: reason.trim() || undefined }, "Estado actualizado.", "PATCH")) {
      setNextStatus(""); setReason("")
    }
  }

  async function upload(file: File) {
    if (file.size > MAX_UPLOAD) { setError("El archivo supera los 20 MB."); return }
    setUploading(true); setError(null); setSuccess(null)
    try {
      // Se registra el adjunto, se sube con la URL firmada y recién ahí queda visible.
      const register = await fetch("/api/attachments", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          claim_id: id, filename: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size, sha256: await sha256Hex(file),
        }),
      })
      if (!register.ok) throw new Error((await register.json().catch(() => null))?.error || "No se pudo registrar el adjunto")
      const { upload_url } = await register.json()
      const put = await fetch(upload_url, { method: "PUT", body: file, headers: { "content-type": file.type || "application/octet-stream" } })
      if (!put.ok) throw new Error("No se pudo subir el archivo")
      setSuccess(`"${file.name}" adjuntado.`)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo adjuntar el archivo.")
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  if (error && !claim) {
    return <Card><CardContent className="space-y-3 p-6"><p role="alert">{error}</p>
      <Button onClick={() => load().catch(() => setError("No se pudo cargar el siniestro."))}>Reintentar</Button></CardContent></Card>
  }
  if (!claim) return <Card><CardContent className="p-6" aria-live="polite">Cargando siniestro…</CardContent></Card>

  const events = [...(claim.claim_events || [])].sort(
    (a, b) => new Date(b.effective_at).getTime() - new Date(a.effective_at).getTime(),
  )
  const options = NEXT_STATUSES[claim.status] || []
  const pendientes = tasks.filter((task) => !["done", "cancelled"].includes(task.status))
  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <div>
        <Link className="text-sm text-primary underline" href={`${basePath}/siniestros`}>← Volver a siniestros</Link>
        <h1 className="mt-2 text-2xl font-semibold">{claim.external_number || claim.claim_type}</h1>
        <p className="text-muted-foreground">
          {claim.clients?.nombre}
          {claim.policies && <> · {claim.policies.numero_poliza}</>}
          {claim.policies?.companies?.name && ` · ${claim.policies.companies.name}`}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{STATUS_LABELS[claim.status] || claim.status}</Badge>
          {claim.occurrence_date && <span className="text-sm text-muted-foreground">Ocurrió el {claim.occurrence_date}</span>}
        </div>
      </div>

      {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
      {success && <p className="text-sm text-emerald-600" role="status">{success}</p>}

      <Card>
        <CardHeader><CardTitle>Avanzar el siniestro</CardTitle></CardHeader>
        <CardContent>
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">Este siniestro está archivado y no admite más cambios.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
              <label className="grid gap-1 text-sm" htmlFor="next-status">
                Pasar a
                <select id="next-status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}
                  className="h-10 rounded-md border bg-background px-3">
                  <option value="">Seleccionar…</option>
                  {options.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-sm" htmlFor="transition-reason">
                Motivo {nextStatus && NEEDS_REASON.includes(nextStatus) ? "(obligatorio)" : "(opcional)"}
                <Input id="transition-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
              <Button className="self-end" disabled={!nextStatus || busy} onClick={changeStatus}>
                {busy ? "Guardando…" : "Actualizar"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader><CardTitle>Historial</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-5 grid gap-2">
              <Label htmlFor="note">Agregar una nota</Label>
              <Textarea id="note" rows={3} value={note} onChange={(event) => setNote(event.target.value)}
                placeholder="Qué pasó, con quién hablaste, qué falta" />
              <Button className="justify-self-start" variant="outline" disabled={!note.trim() || busy}
                onClick={async () => { if (await send(`/api/claims/${id}/events`, { type: "note_added", payload: { note: note.trim() } }, "Nota guardada.")) setNote("") }}>
                Guardar nota
              </Button>
            </div>

            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay movimientos en este siniestro.</p>
            ) : (
              <ol className="space-y-4 border-l pl-4">
                {events.map((event: any) => {
                  const texto = event.payload?.note || event.payload?.reason
                  return (
                    <li key={event.id} className="relative">
                      <span className="absolute -left-[21px] top-2 h-2 w-2 rounded-full bg-border" />
                      <p className="text-sm font-medium">
                        {EVENT_LABELS[event.type] || event.type}
                        {event.type === "status_changed" && event.to_status && (
                          <span className="font-normal text-muted-foreground">
                            {" "}· {STATUS_LABELS[event.from_status] || event.from_status} → {STATUS_LABELS[event.to_status] || event.to_status}
                          </span>
                        )}
                      </p>
                      {texto && <p className="mt-1 whitespace-pre-wrap text-sm">{texto}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(event.effective_at).toLocaleString("es-UY")}
                      </p>
                    </li>
                  )
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pendientes</CardTitle>
              <p className="text-sm text-muted-foreground">Lo que falta hacer en este siniestro, con su fecha límite.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)}
                  placeholder="Ej: pedir la denuncia policial" />
                <div className="flex gap-2">
                  <Input type="date" value={taskDue} onChange={(event) => setTaskDue(event.target.value)} />
                  <Button variant="outline" disabled={!taskTitle.trim() || busy}
                    onClick={async () => {
                      const body: Record<string, unknown> = { title: taskTitle.trim() }
                      if (taskDue) body.due_at = new Date(`${taskDue}T09:00:00`).toISOString()
                      if (await send(`/api/claims/${id}/tasks`, body, "Pendiente agregado.")) { setTaskTitle(""); setTaskDue("") }
                    }}>
                    Agregar
                  </Button>
                </div>
              </div>

              {pendientes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada pendiente.</p>
              ) : (
                <ul className="space-y-2">
                  {pendientes.map((task) => {
                    const vencida = task.due_at && task.due_at.slice(0, 10) < hoy
                    return (
                      <li key={task.id} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                        <input type="checkbox" className="mt-1" aria-label={`Marcar "${task.title}" como hecha`}
                          onChange={() => void send(`/api/claims/${id}/tasks`, { id: task.id, status: "done" }, "Pendiente completado.", "PATCH")} />
                        <span className="flex-1">
                          {task.title}
                          {task.due_at && (
                            <span className={`block text-xs ${vencida ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                              {vencida ? "Vencía" : "Para"} el {new Date(task.due_at).toLocaleDateString("es-UY")}
                            </span>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documentos</CardTitle>
              <p className="text-sm text-muted-foreground">Quedan privados hasta que los compartas con el cliente.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <input ref={fileInput} type="file" className="hidden"
                onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file) }} />
              <Button variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />{uploading ? "Subiendo…" : "Adjuntar archivo"}
              </Button>

              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin documentos adjuntos.</p>
              ) : (
                <ul className="space-y-2">
                  {attachments.map((file) => (
                    <li key={file.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{file.filename}</span>
                        {file.visibility === "portal_shared" && !file.revoked_at && <Badge variant="secondary">Compartido</Badge>}
                        {file.revoked_at && <Badge variant="outline">Revocado</Badge>}
                      </span>
                      {!file.revoked_at && !file.archived_at && (
                        <Button size="sm" variant="ghost" disabled={busy}
                          onClick={() => void send(`/api/attachments/${file.id}`,
                            file.visibility === "portal_shared"
                              ? { action: "revoke", reason: "Revocado desde el siniestro" }
                              : { action: "share" },
                            file.visibility === "portal_shared" ? "Acceso revocado." : "Compartido con el cliente.", "PATCH")}>
                          {file.visibility === "portal_shared" ? "Revocar" : "Compartir"}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
