"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

const PERIODOS = [
  { key: "mensual",     label: "Este mes" },
  { key: "trimestral",  label: "Trimestre" },
  { key: "anual",       label: "Este año" },
  { key: "total",       label: "Total acumulado" },
]

export function FacturacionFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get("periodo") || "total"

  const set = (periodo: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("periodo", periodo)
    params.delete("page")
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {PERIODOS.map(({ key, label }) => (
        <Button
          key={key}
          variant={current === key ? "default" : "outline"}
          size="sm"
          onClick={() => set(key)}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}
