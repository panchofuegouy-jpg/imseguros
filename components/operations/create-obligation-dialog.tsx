"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { HandCoins, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Company = { id: string; name: string }
type PolicyOption = {
  id: string
  numero_poliza: string
  clients?: { id: string; nombre: string } | null
  companies?: { id: string; name: string } | null
}

export function CreateObligationDialog({ companies }: { companies: Company[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<PolicyOption[]>([])
  const [policy, setPolicy] = useState<PolicyOption | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || policy) return
    const timer = setTimeout(() => {
      fetch(`/api/policies?limit=15${search.trim() ? `&q=${encodeURIComponent(search.trim())}` : ""}`)
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error("busqueda"))))
        .then((payload) => setResults(payload.data || []))
        .catch(() => setError("No se pudieron buscar las pólizas."))
    }, 250)
    return () => clearTimeout(timer)
  }, [search, open, policy])

  useEffect(() => {
    if (open) return
    setPolicy(null); setSearch(""); setResults([]); setError(null)
  }, [open])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const installment = String(form.get("installment_number") || "").trim()
    const response = await fetch("/api/collections/obligations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        company_id: form.get("company_id"),
        client_id: policy?.clients?.id ?? null,
        policy_id: policy?.id ?? null,
        external_reference: String(form.get("external_reference") || "").trim() || null,
        due_date: form.get("due_date"),
        amount: Number(form.get("amount")),
        currency: form.get("currency") || "UYU",
        installment_number: installment ? Number(installment) : null,
      }),
    })
    setSaving(false)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error || "No se pudo registrar la obligación.")
      return
    }
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><HandCoins className="mr-2 h-4 w-4" />Registrar deuda</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar deuda</DialogTitle>
          <DialogDescription>
            La cuota se agrupa automáticamente con el resto de la deuda de esa persona.
          </DialogDescription>
        </DialogHeader>

        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

        {!policy ? (
          <div className="space-y-3">
            <Label htmlFor="obligation-policy">Póliza de la deuda</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="obligation-policy" autoFocus className="pl-9"
                placeholder="Número de póliza, asegurado o documento"
                value={search} onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {results.length === 0 && <p className="p-2 text-sm text-muted-foreground">Sin resultados.</p>}
              {results.map((option) => (
                <button
                  key={option.id} type="button" onClick={() => setPolicy(option)}
                  className="w-full rounded-md border p-3 text-left text-sm transition hover:bg-accent"
                >
                  <span className="font-medium">{option.numero_poliza}</span>
                  <span className="block text-xs text-muted-foreground">
                    {option.clients?.nombre || "Sin titular"}
                    {option.companies?.name ? ` · ${option.companies.name}` : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={submit}>
            <div className="flex items-start justify-between gap-3 rounded-md border bg-muted/40 p-3 text-sm">
              <div>
                <p className="font-medium">{policy.numero_poliza}</p>
                <p className="text-xs text-muted-foreground">{policy.clients?.nombre || "Sin titular"}</p>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPolicy(null)}>Cambiar</Button>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="company_id">Compañía</Label>
              <select
                id="company_id" name="company_id" required
                defaultValue={policy.companies?.id || ""}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Seleccionar…</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="due_date">Vencimiento</Label>
                <Input id="due_date" name="due_date" type="date" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="installment_number">Número de cuota</Label>
                <Input id="installment_number" name="installment_number" type="number" min="1" placeholder="Opcional" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount">Importe</Label>
                <Input id="amount" name="amount" type="number" min="0" step="0.01" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency">Moneda</Label>
                <select id="currency" name="currency" defaultValue="UYU" className="h-10 rounded-md border bg-background px-3 text-sm">
                  <option value="UYU">UYU</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="external_reference">Referencia externa</Label>
              <Input id="external_reference" name="external_reference" placeholder="Recibo o referencia de la compañía" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Registrar deuda"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
