"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Client {
  id: string
  created_at: string
}

interface ClientsByMonthChartProps {
  clients: Client[]
}

export function ClientsByMonthChart({ clients }: ClientsByMonthChartProps) {
  const buckets = clients.reduce((acc, client) => {
    const date = new Date(client.created_at)
    if (Number.isNaN(date.getTime())) return acc

    // Clave ordenable AAAA-MM, etiqueta legible para el eje
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleString('es', { month: 'long', year: 'numeric' })

    const existing = acc.get(key)
    if (existing) {
      existing.count++
    } else {
      acc.set(key, { key, month: label, count: 1 })
    }

    return acc
  }, new Map<string, { key: string; month: string; count: number }>())

  const data = Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevos Clientes por Mes</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="count" stroke="#8884d8" name="Nuevos Clientes" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
