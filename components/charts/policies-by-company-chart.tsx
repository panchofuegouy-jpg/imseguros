"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#ffc658"]

interface Policy {
  id: string
  company_id: string
}

interface Company {
  id: string
  name: string
}

interface PoliciesByCompanyChartProps {
  policies: Policy[]
  companies: Company[]
}

export function PoliciesByCompanyChart({ policies, companies }: PoliciesByCompanyChartProps) {
  const data = companies.map(company => {
    const policyCount = policies.filter(p => p.company_id === company.id).length
    return { name: company.name, value: policyCount }
  }).filter(item => item.value > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribución de Pólizas por Aseguradora</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}