"use client"

import { useMemo, useState } from "react"
import { Download, FileText, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export type SharedPolicy = {
  id: string
  numero: string
  company?: string
  tipo?: string
  detail?: string
  vigencia: string
  file?: string
}

// Sin mayúsculas, tildes ni separadores: «SAB-1234», «sab 1234» y «sab1234» son lo mismo.
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()

export function PoliciesList({ policies }: { policies: SharedPolicy[] }) {
  const [query, setQuery] = useState("")

  const visible = useMemo(() => {
    const words = query.split(/\s+/).map(normalize).filter(Boolean)
    if (!words.length) return policies
    return policies.filter((p) => {
      const haystack = normalize([p.numero, p.company, p.tipo, p.detail, p.vigencia].filter(Boolean).join(" "))
      // La matrícula escrita junta o separada tiene que encontrar lo mismo.
      return words.every((w) => haystack.includes(w)) || haystack.includes(normalize(query))
    })
  }, [policies, query])

  return (
    <>
      {policies.length > 1 && (
        <div className="relative mt-6">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por número, matrícula, marca, modelo…"
            aria-label="Buscar póliza"
            className="pl-10"
          />
        </div>
      )}

      {!visible.length ? (
        <p className="mt-8 text-muted-foreground">No encontramos pólizas con «{query.trim()}».</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {visible.map((p) => (
            <li key={p.id} className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    Póliza {p.numero}
                    <span className="font-normal text-muted-foreground"> · {[p.company, p.tipo].filter(Boolean).join(" · ")}</span>
                  </p>
                  {p.detail && <p className="mt-0.5 text-sm text-foreground/80">{p.detail}</p>}
                  <p className="mt-1 text-sm text-muted-foreground">Vigencia {p.vigencia}</p>
                </div>
              </div>
              {p.file && (
                <a
                  href={p.file}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  <Download className="size-4" aria-hidden />
                  Descargar PDF
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
