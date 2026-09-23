"use client"

import { Button } from "@/components/ui/button"

export type Moneda = "UYU" | "USD"

interface CurrencyToggleProps {
  value: Moneda
  onChange: (moneda: Moneda) => void
}

const MONEDAS: Moneda[] = ["UYU", "USD"]

export function CurrencyToggle({ value, onChange }: CurrencyToggleProps) {
  return (
    <div className="flex gap-1">
      {MONEDAS.map((m) => (
        <Button
          key={m}
          variant={value === m ? "default" : "outline"}
          size="sm"
          className="px-2"
          onClick={() => onChange(m)}
        >
          {m}
        </Button>
      ))}
    </div>
  )
}
