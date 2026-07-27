"use client"

import { useState } from "react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CurrencyToggle, type Moneda } from "@/components/charts/currency-toggle"

interface EvolucionEntry {
  periodo: string
  UYU: number
  USD: number
}

interface PrimaEvolucionChartProps {
  data: EvolucionEntry[]
  titulo: string
}

const fmt = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)

const COLORS: Record<Moneda, string> = { UYU: "#0088FE", USD: "#25595E" }

export function PrimaEvolucionChart({ data, titulo }: PrimaEvolucionChartProps) {
  const [moneda, setMoneda] = useState<Moneda>("UYU")

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>{titulo}</CardTitle>
        <CurrencyToggle value={moneda} onChange={setMoneda} />
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
            Sin datos para el período seleccionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) =>
                  [`${moneda} ${value.toLocaleString("es-UY", { minimumFractionDigits: 2 })}`, "Prima"]
                }
              />
              <Bar dataKey={moneda} fill={COLORS[moneda]} name={moneda} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
