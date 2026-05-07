"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PrimaTipoEntry {
  tipo: string
  total: number
  moneda: string
}

interface PrimaPorTipoChartProps {
  data: PrimaTipoEntry[]
  moneda: "UYU" | "USD"
}

const formatMonto = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(0)

export function PrimaPorTipoChart({ data, moneda }: PrimaPorTipoChartProps) {
  const filtered = data.filter(d => d.moneda === moneda)

  if (filtered.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prima por Tipo de Póliza ({moneda})</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
          Sin datos en {moneda}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prima por Tipo de Póliza ({moneda})</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={filtered} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={formatMonto} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="tipo" tick={{ fontSize: 11 }} width={80} />
            <Tooltip
              formatter={(value: number) => [
                `${moneda} ${value.toLocaleString("es-UY", { minimumFractionDigits: 2 })}`,
                "Prima total",
              ]}
            />
            <Bar dataKey="total" fill="#8884d8" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
