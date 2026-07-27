"use client"

import { useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CurrencyToggle, type Moneda } from "@/components/charts/currency-toggle"

interface PrimaTipoEntry {
  tipo: string
  total: number
  moneda: string
}

interface PrimaPorTipoChartProps {
  data: PrimaTipoEntry[]
}

const TOP_N = 8

const formatMonto = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(0)

const COLORS: Record<Moneda, string> = { UYU: "#8884d8", USD: "#25595E" }

export function PrimaPorTipoChart({ data }: PrimaPorTipoChartProps) {
  const [moneda, setMoneda] = useState<Moneda>("UYU")

  const sorted = data
    .filter((d) => d.moneda === moneda && d.total > 0)
    .sort((a, b) => b.total - a.total)

  const top = sorted.slice(0, TOP_N)
  const rest = sorted.slice(TOP_N)
  const chartData = rest.length > 0
    ? [...top, { tipo: "Otros", total: rest.reduce((a, d) => a + d.total, 0) }]
    : top

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Prima por Tipo de Póliza</CardTitle>
        <CurrencyToggle value={moneda} onChange={setMoneda} />
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
            Sin datos en {moneda}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={formatMonto} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="tipo" tick={{ fontSize: 11 }} width={110} />
              <Tooltip
                formatter={(value: number) => [
                  `${moneda} ${value.toLocaleString("es-UY", { minimumFractionDigits: 2 })}`,
                  "Prima total",
                ]}
              />
              <Bar dataKey="total" fill={COLORS[moneda]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
