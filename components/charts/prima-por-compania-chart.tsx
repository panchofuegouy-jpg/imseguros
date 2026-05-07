"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface PrimaEntry {
  company: string
  UYU: number
  USD: number
}

interface PrimaPorCompaniaChartProps {
  data: PrimaEntry[]
}

const formatMonto = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(0)

export function PrimaPorCompaniaChart({ data }: PrimaPorCompaniaChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Prima por Aseguradora</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
          Sin datos de facturación cargados aún
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prima por Aseguradora</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="company"
              tick={{ fontSize: 11 }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tickFormatter={formatMonto} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number, name: string) =>
                [`${name} ${value.toLocaleString("es-UY", { minimumFractionDigits: 2 })}`, name]
              }
            />
            <Legend verticalAlign="top" />
            <Bar dataKey="UYU" fill="#0088FE" name="UYU" radius={[4, 4, 0, 0]} />
            <Bar dataKey="USD" fill="#00C49F" name="USD" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
