"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, Search, User } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

interface ClientHit {
  id: string
  nombre: string
  documento: string | null
  telefono: string | null
}

interface PolicyHit {
  id: string
  numero_poliza: string
  client_id: string
  clients: { nombre: string } | null
  companies: { name: string } | null
}

/**
 * Buscador de toda la app: clientes por nombre, cédula o teléfono y pólizas por
 * número. Se abre con el botón de la barra superior o con Ctrl/⌘ + K.
 */
export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState("")
  const [clients, setClients] = useState<ClientHit[]>([])
  const [policies, setPolicies] = useState<PolicyHit[]>([])
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)
  const router = useRouter()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    const query = term.trim()
    if (query.length < 2) {
      setClients([])
      setPolicies([])
      setLoading(false)
      return
    }

    const current = ++requestId.current
    setLoading(true)
    const timeout = setTimeout(async () => {
      const supabase = createClient()
      // Las comas y paréntesis rompen la sintaxis de .or() de PostgREST.
      const safe = query.replace(/[,()]/g, " ")
      const [clientsResult, policiesResult] = await Promise.all([
        supabase
          .from("clients")
          .select("id, nombre, documento, telefono")
          .or(`nombre.ilike.%${safe}%,documento.ilike.%${safe}%,telefono.ilike.%${safe}%`)
          .order("nombre")
          .limit(8),
        supabase
          .from("policies")
          .select("id, numero_poliza, client_id, clients(nombre), companies(name)")
          .ilike("numero_poliza", `%${safe}%`)
          .limit(5),
      ])
      if (current !== requestId.current) return
      setClients((clientsResult.data as ClientHit[]) ?? [])
      setPolicies((policiesResult.data as unknown as PolicyHit[]) ?? [])
      setLoading(false)
    }, 220)

    return () => clearTimeout(timeout)
  }, [term])

  const go = (href: string) => {
    setOpen(false)
    setTerm("")
    router.push(href)
  }

  const hasQuery = term.trim().length >= 2

  return (
    <>
      <button
        type="button"
        data-tour="search"
        onClick={() => setOpen(true)}
        className="group flex h-11 w-full max-w-md items-center gap-3 rounded-full border border-input bg-card px-4 text-left text-base text-muted-foreground shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
      >
        <Search className="size-5 shrink-0 transition-colors group-hover:text-primary" aria-hidden />
        <span className="flex-1 truncate">Buscar cliente o póliza…</span>
        <kbd className="hidden rounded-md border bg-muted px-1.5 py-0.5 font-sans text-xs text-muted-foreground md:inline">
          Ctrl K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Buscar"
        description="Buscá un cliente por nombre, cédula o teléfono, o una póliza por su número."
        className="top-[18%] translate-y-0 sm:max-w-xl"
        showCloseButton={false}
        shouldFilter={false}
      >
        <CommandInput
          value={term}
          onValueChange={setTerm}
          placeholder="Nombre, cédula, teléfono o número de póliza"
          className="h-14 text-lg"
        />
        <CommandList className="max-h-[60vh]">
          {!hasQuery && (
            <p className="px-4 py-8 text-center text-base text-muted-foreground">
              Escribí al menos dos letras para empezar.
            </p>
          )}
          {hasQuery && !loading && (
            <CommandEmpty>
              <span className="text-base">No encontré nada con «{term.trim()}».</span>
            </CommandEmpty>
          )}
          {hasQuery && loading && clients.length === 0 && policies.length === 0 && (
            <p className="px-4 py-8 text-center text-base text-muted-foreground">Buscando…</p>
          )}
          {clients.length > 0 && (
            <CommandGroup heading="Clientes">
              {clients.map((client) => (
                <CommandItem
                  key={client.id}
                  value={`cliente-${client.id}`}
                  onSelect={() => go(`/admin/clientes/${client.id}`)}
                  className="gap-3 py-3 text-base"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                    <User className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{client.nombre}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[client.documento && `C.I. ${client.documento}`, client.telefono].filter(Boolean).join(" · ") ||
                        "Sin datos de contacto"}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {policies.length > 0 && (
            <CommandGroup heading="Pólizas">
              {policies.map((policy) => (
                <CommandItem
                  key={policy.id}
                  value={`poliza-${policy.id}`}
                  onSelect={() => go(`/admin/clientes/${policy.client_id}`)}
                  className="gap-3 py-3 text-base"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <FileText className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">Póliza {policy.numero_poliza}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[policy.clients?.nombre, policy.companies?.name].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
