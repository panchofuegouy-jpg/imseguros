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
  const data = clients.reduce((acc, client) => {
    const month = new Date(client.created_at).toLocaleString('default', { month: 'long', year: 'numeric' })
    const existingMonth = acc.find(item => item.month === month)

    if (existingMonth) {
      existingMonth.count++
    } else {
      acc.push({ month, count: 1 })
    }

    return acc
  }, [] as { month: string; count: number }[]).reverse()

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
