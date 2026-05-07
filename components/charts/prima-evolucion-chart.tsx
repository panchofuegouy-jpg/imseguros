"use client"

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

export function PrimaEvolucionChart({ data, titulo }: PrimaEvolucionChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>{titulo}</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
          Sin datos para el período seleccionado
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle>{titulo}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="periodo" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
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
