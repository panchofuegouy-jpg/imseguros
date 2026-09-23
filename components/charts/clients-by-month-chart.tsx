"use client"

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { SectionCard } from "@/components/brand/section-card"

interface ClientsByMonthChartProps {
  /** Clientes dados de alta en los últimos 12 meses. */
  clients: { created_at: string }[]
}

const SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const LONG_MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

export function ClientsByMonthChart({ clients }: ClientsByMonthChartProps) {
  // Los 12 meses siempre presentes, aunque alguno tenga cero altas.
  const now = new Date()
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1)
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: SHORT_MONTHS[date.getMonth()],
      fullLabel: `${LONG_MONTHS[date.getMonth()]} ${date.getFullYear()}`,
      count: 0,
    }
  })
  const byKey = new Map(months.map((month) => [month.key, month]))
  for (const client of clients) {
    const date = new Date(client.created_at)
    if (Number.isNaN(date.getTime())) continue
    const bucket = byKey.get(`${date.getFullYear()}-${date.getMonth()}`)
    if (bucket) bucket.count++
  }
  const total = months.reduce((sum, month) => sum + month.count, 0)

  return (
    <SectionCard title="Clientes nuevos por mes" description={`${total} en los últimos 12 meses`}>
      <div className="h-[280px] pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months} margin={{ top: 24, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 14, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 13, fill: "var(--muted-foreground)" }}
            />
            <Tooltip
              cursor={{ fill: "var(--accent)" }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel ?? ""}
              formatter={(value: number) => [value, "Clientes nuevos"]}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                fontSize: 15,
              }}
            />
            <Bar dataKey="count" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={36}>
              <LabelList
                dataKey="count"
                position="top"
                className="tabular-nums"
                style={{ fontSize: 13, fill: "var(--muted-foreground)" }}
                formatter={(value: number) => (value ? value : "")}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  )
}
