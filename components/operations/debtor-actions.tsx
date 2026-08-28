"use client"

import { FormEvent, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type Obligation = { id: string; label: string; currency: string; balance: number }

export function DebtorActions({ debtorId, obligations }: { debtorId: string; obligations: Obligation[] }) {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-wrap items-center gap-3">
      <RegisterContactDialog
        debtorId={debtorId}
        obligations={obligations}
        onDone={(text) => { setMessage(text); setError(null); router.refresh() }}
        onError={(text) => { setError(text); setMessage(null) }}
      />
      <RegisterPaymentDialog
        debtorId={debtorId}
        obligations={obligations}
        onDone={(text) => { setMessage(text); setError(null); router.refresh() }}
        onError={(text) => { setError(text); setMessage(null) }}
      />
      {message && <p role="status" className="text-sm text-emerald-600">{message}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

function RegisterContactDialog({ debtorId, obligations, onDone, onError }: {
  debtorId: string; obligations: Obligation[]
  onDone: (message: string) => void; onError: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    const form = new FormData(event.currentTarget)
    const nextAction = String(form.get("next_action_at") || "")
    const obligationId = String(form.get("obligation_id") || "")
    const response = await fetch(`/api/collections/debtors/${debtorId}/contacts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channel: form.get("channel"),
        outcome: form.get("outcome"),
        note: String(form.get("note") || "").trim() || undefined,
        next_action_at: nextAction ? new Date(`${nextAction}T09:00:00`).toISOString() : undefined,
        obligation_id: obligationId || undefined,
      }),
    })
    setSaving(false)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      onError(payload?.error || "No se pudo registrar la gestión.")
      return
    }
    setOpen(false)
    onDone("Gestión registrada.")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Registrar gestión</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar gestión</DialogTitle>
          <DialogDescription>
            Queda en el historial de la persona y actualiza su estado en el tablero.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="channel">Canal</Label>
            <select id="channel" name="channel" defaultValue="telefono" className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="telefono">Teléfono</option>
              <option value="email">Email</option>
              <option value="presencial">Presencial</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="outcome">Resultado</Label>
            <select id="outcome" name="outcome" defaultValue="contactado" className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="contactado">Contactado</option>
              <option value="promesa">Promesa de pago</option>
              <option value="pagó">Pagó</option>
              <option value="no_renovó">No renovó</option>
              <option value="baja">Dar de baja la gestión</option>
            </select>
          </div>
          {obligations.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="obligation_id">Sobre una cuota puntual (opcional)</Label>
              <select id="obligation_id" name="obligation_id" defaultValue="" className="h-10 rounded-md border bg-background px-3 text-sm">
                <option value="">Toda la deuda</option>
                {obligations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="next_action_at">Volver a contactar el</Label>
            <Input id="next_action_at" name="next_action_at" type="date" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="note">Nota</Label>
            <Textarea id="note" name="note" rows={3} placeholder="Qué se habló" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar gestión"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RegisterPaymentDialog({ debtorId, obligations, onDone, onError }: {
  debtorId: string; obligations: Obligation[]
  onDone: (message: string) => void; onError: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [obligationId, setObligationId] = useState(obligations[0]?.id || "")
  // Estable mientras el formulario no se envíe con éxito: un doble clic o un
  // reintento por red reusan la clave y el servidor devuelve el pago ya hecho.
  const idempotencyKey = useRef(crypto.randomUUID())

  const selected = obligations.find((item) => item.id === obligationId)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    setSaving(true)
    const form = new FormData(event.currentTarget)
    const response = await fetch(`/api/collections/obligations/${selected.id}/payments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amount: Number(form.get("amount")),
        currency: selected.currency,
        reference: String(form.get("reference") || "").trim() || undefined,
        note: String(form.get("note") || "").trim() || undefined,
        idempotency_key: `${debtorId}:${idempotencyKey.current}`,
      }),
    })
    setSaving(false)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      onError(payload?.error || "No se pudo registrar el pago.")
      return
    }
    idempotencyKey.current = crypto.randomUUID()
    setOpen(false)
    onDone("Pago registrado.")
  }

  if (obligations.length === 0) {
    return <Button variant="outline" disabled>Sin cuotas pendientes</Button>
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">Registrar pago</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            El pago se imputa a una cuota. Si queda sin saldo, la persona pasa sola a “Al día”.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-2">
            <Label htmlFor="obligation">Cuota</Label>
            <select
              id="obligation"
              value={obligationId}
              onChange={(event) => setObligationId(event.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              {obligations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="amount">Importe ({selected?.currency})</Label>
            <Input
              id="amount" name="amount" type="number" required
              min="0.01" step="0.01" max={selected?.balance}
              defaultValue={selected?.balance}
            />
            <p className="text-xs text-muted-foreground">Saldo de esa cuota: {selected?.balance}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reference">Referencia</Label>
            <Input id="reference" name="reference" placeholder="Recibo, transferencia…" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payment-note">Nota interna</Label>
            <Input id="payment-note" name="note" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Registrando…" : "Registrar pago"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
