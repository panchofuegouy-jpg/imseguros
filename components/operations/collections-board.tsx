"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, CalendarClock, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DEBTOR_COLUMNS, formatDebt, isDueForContact,
  type DebtorStatus, type DebtorSummary,
} from "@/lib/collections"

/** Estados en los que mover la tarjeta exige explicar por qué. */
const REQUIRE_NOTE: DebtorStatus[] = ["no_renovo", "incobrable"]

export function CollectionsBoard({ basePath }: { basePath: string }) {
  const [debtors, setDebtors] = useState<DebtorSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<DebtorStatus | null>(null)
  const [moving, setMoving] = useState(false)

  const load = useCallback((term = "") => {
    setError(null)
    return fetch(`/api/collections/debtors${term ? `?q=${encodeURIComponent(term)}` : ""}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("carga"))))
      .then((payload) => setDebtors(payload.data || []))
      .catch(() => setError("No se pudo cargar la cartera. Reintentá."))
  }, [])

  useEffect(() => { void load() }, [load])

  async function move(debtorId: string, status: DebtorStatus) {
    const debtor = debtors?.find((item) => item.id === debtorId)
    if (!debtor || debtor.status === status) return

    let note: string | undefined
    if (REQUIRE_NOTE.includes(status)) {
      const column = DEBTOR_COLUMNS.find((item) => item.value === status)
      const answer = window.prompt(`¿Por qué pasás a ${debtor.display_name} a "${column?.label}"?`)
      if (answer === null) return
      if (!answer.trim()) { setError("Ese estado necesita una nota."); return }
      note = answer.trim()
    }

    setMoving(true)
    const previous = debtors
    // Optimista: la tarjeta se mueve al soltar y vuelve si el servidor rechaza.
    setDebtors((current) => current?.map((item) => item.id === debtorId ? { ...item, status } : item) ?? null)
    const response = await fetch(`/api/collections/debtors/${debtorId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, note }),
    })
    setMoving(false)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error || "No se pudo mover el deudor.")
      setDebtors(previous ?? null)
      return
    }
    void load(search)
  }

  if (error && !debtors) {
    return (
      <div className="space-y-3 rounded-lg border p-6">
        <p role="alert">{error}</p>
        <Button onClick={() => void load()}>Reintentar</Button>
      </div>
    )
  }
  if (!debtors) return <p className="p-6 text-muted-foreground" aria-live="polite">Cargando cartera…</p>

  const pendientesHoy = debtors.filter((debtor) => isDueForContact(debtor))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form
          className="relative w-full max-w-sm"
          onSubmit={(event) => { event.preventDefault(); void load(search) }}
        >
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o documento"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </form>
        {pendientesHoy.length > 0 && (
          <Badge variant="destructive" className="gap-1">
            <CalendarClock className="h-3 w-3" />
            {pendientesHoy.length} para contactar hoy
          </Badge>
        )}
        <span className="text-sm text-muted-foreground">{debtors.length} deudores</span>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {DEBTOR_COLUMNS.map((column) => {
          const items = debtors.filter((debtor) => debtor.status === column.value)
          return (
            <section
              key={column.value}
              onDragOver={(event) => { event.preventDefault(); setOver(column.value) }}
              onDragLeave={() => setOver((current) => (current === column.value ? null : current))}
              onDrop={(event) => {
                event.preventDefault()
                setOver(null)
                const id = event.dataTransfer.getData("text/plain") || dragging
                if (id) void move(id, column.value)
              }}
              className={`rounded-lg border p-3 transition ${over === column.value ? "border-primary bg-primary/5" : "bg-muted/30"}`}
              aria-label={column.label}
            >
              <header className="mb-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{column.label}</h2>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <p className="mt-1 text-xs leading-tight text-muted-foreground">{column.hint}</p>
              </header>

              <div className="space-y-2">
                {items.length === 0 && (
                  <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">Vacío</p>
                )}
                {items.map((debtor) => {
                  const vencido = isDueForContact(debtor)
                  return (
                    <article
                      key={debtor.id}
                      draggable={!moving}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", debtor.id)
                        setDragging(debtor.id)
                      }}
                      onDragEnd={() => setDragging(null)}
                      className={`cursor-grab rounded-md border bg-background p-3 text-sm shadow-sm active:cursor-grabbing ${dragging === debtor.id ? "opacity-50" : ""}`}
                    >
                      <Link className="font-medium underline" href={`${basePath}/cobranza/${debtor.id}`}>
                        {debtor.display_name}
                      </Link>
                      <p className="mt-1 font-medium">{formatDebt(debtor.saldo_por_moneda)}</p>
                      <p className="text-xs text-muted-foreground">
                        {debtor.cuotas} {debtor.cuotas === 1 ? "cuota" : "cuotas"}
                        {debtor.polizas > 0 && ` · ${debtor.polizas} ${debtor.polizas === 1 ? "póliza" : "pólizas"}`}
                      </p>
                      {debtor.cuotas_vencidas > 0 && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {debtor.cuotas_vencidas} vencidas
                        </p>
                      )}
                      {debtor.next_action_at && (
                        <p className={`mt-1 text-xs ${vencido ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                          {vencido ? "Contactar" : "Vuelve"} el {new Date(debtor.next_action_at).toLocaleDateString("es-UY")}
                        </p>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Arrastrá una tarjeta para cambiar el estado de gestión. Pasar a “No renovó” o “Incobrable” pide una nota, que queda en el historial del deudor.
      </p>
    </div>
  )
}
