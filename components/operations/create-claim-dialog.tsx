"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export type PolicyOption = {
  id: string
  numero_poliza: string
  tipo?: string | null
  vigencia_fin?: string | null
  clients?: { id: string; nombre: string; documento?: string | null } | null
  companies?: { id: string; name: string } | null
}

type Props = {
  basePath: string
  /** Cuando el modal se abre desde una póliza, el paso de búsqueda se saltea. */
  policy?: PolicyOption
  trigger?: React.ReactNode
  onCreated?: () => void
}

export function CreateClaimDialog({ basePath, policy, trigger, onCreated }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<PolicyOption | null>(policy ?? null)
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<PolicyOption[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchSeq = useRef(0)

  // Al cerrarse vuelve al estado inicial, respetando la póliza fija si la hay.
  useEffect(() => {
    if (open) return
    setSelected(policy ?? null)
    setSearch("")
    setResults([])
    setError(null)
  }, [open, policy])

  useEffect(() => {
    if (selected || !open) return
    const term = search.trim()
    const seq = ++searchSeq.current
    setSearching(true)
    const timer = setTimeout(() => {
      fetch(`/api/policies?limit=20${term ? `&q=${encodeURIComponent(term)}` : ""}`)
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error("busqueda"))))
        .then((payload) => { if (seq === searchSeq.current) setResults(payload.data || []) })
        .catch(() => { if (seq === searchSeq.current) setError("No se pudieron buscar las pólizas.") })
        .finally(() => { if (seq === searchSeq.current) setSearching(false) })
    }, 250)
    return () => clearTimeout(timer)
  }, [search, selected, open])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    setSaving(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const estimated = String(form.get("estimated_amount") || "").trim()
    const response = await fetch("/api/claims", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policy_id: selected.id,
        claim_type: form.get("claim_type"),
        occurrence_date: String(form.get("occurrence_date") || "") || null,
        external_number: String(form.get("external_number") || "").trim() || null,
        description: String(form.get("description") || "").trim() || null,
        estimated_amount: estimated ? Number(estimated) : null,
        priority: form.get("priority") || "normal",
      }),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error || "No se pudo crear el siniestro. Revisá los datos.")
      setSaving(false)
      return
    }
    const created = await response.json()
    setSaving(false)
    setOpen(false)
    onCreated?.()
    router.push(`${basePath}/siniestros/${created.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button><ShieldAlert className="mr-2 h-4 w-4" />Nuevo siniestro</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo siniestro</DialogTitle>
          <DialogDescription>
            {selected
              ? "El siniestro queda asociado a esta póliza y a su titular."
              : "Elegí la póliza afectada. El cliente se toma de la póliza."}
          </DialogDescription>
        </DialogHeader>

        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

        {!selected ? (
          <div className="space-y-3">
            <Label htmlFor="policy-search">Buscar póliza</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="policy-search"
                autoFocus
                className="pl-9"
                placeholder="Número de póliza, asegurado o documento"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto" aria-live="polite">
              {searching && <p className="p-2 text-sm text-muted-foreground">Buscando…</p>}
              {!searching && results.length === 0 && (
                <p className="p-2 text-sm text-muted-foreground">
                  {search.trim() ? "Ninguna póliza coincide con esa búsqueda." : "No hay pólizas cargadas todavía."}
                </p>
              )}
              {results.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelected(option)}
                  className="w-full rounded-md border p-3 text-left text-sm transition hover:bg-accent"
                >
                  <span className="font-medium">{option.numero_poliza}</span>
                  <span className="ml-2 text-muted-foreground">{option.companies?.name || "Sin compañía"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {option.clients?.nombre || "Sin titular"}
                    {option.tipo ? ` · ${option.tipo}` : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={submit}>
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{selected.numero_poliza}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.clients?.nombre || "Sin titular"}
                    {selected.companies?.name ? ` · ${selected.companies.name}` : ""}
                  </p>
                </div>
                {!policy && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(null)}>
                    Cambiar
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="claim_type">Tipo de siniestro</Label>
                <Input id="claim_type" name="claim_type" required placeholder="Choque, robo, granizo…" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="occurrence_date">Fecha de ocurrencia</Label>
                <Input id="occurrence_date" name="occurrence_date" type="date" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="external_number">Número de la aseguradora</Label>
                <Input id="external_number" name="external_number" placeholder="Opcional" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="estimated_amount">Monto estimado</Label>
                <Input id="estimated_amount" name="estimated_amount" type="number" min="0" step="0.01" placeholder="Opcional" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="priority">Prioridad</Label>
              <select id="priority" name="priority" defaultValue="normal" className="h-10 rounded-md border bg-background px-3 text-sm">
                <option value="low">Baja</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" name="description" rows={4} placeholder="Qué pasó, dónde y cuándo" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Creando…" : "Crear siniestro"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
