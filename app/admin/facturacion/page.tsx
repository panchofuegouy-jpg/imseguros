import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminLayout } from "@/components/admin-layout"
import { PrimaPorCompaniaChart } from "@/components/charts/prima-por-compania-chart"
import { PrimaPorTipoChart } from "@/components/charts/prima-por-tipo-chart"
import { DollarSign, TrendingUp, FileText, AlertCircle } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

async function getData() {
  const supabase = await createClient()

  const { data: policies } = await supabase
    .from("policies")
    .select("id, prima_monto, moneda, forma_pago, tipo, companies(name)")

  const { count: totalPolicies } = await supabase
    .from("policies")
    .select("*", { count: "exact", head: true })

  const all = policies || []
  const withMonto = all.filter(p => p.prima_monto != null)
  const sinMonto = all.length - withMonto.length

  // Totales por moneda
  const totalUYU = withMonto
    .filter(p => (p.moneda || "UYU") === "UYU")
    .reduce((acc, p) => acc + Number(p.prima_monto), 0)
  const totalUSD = withMonto
    .filter(p => p.moneda === "USD")
    .reduce((acc, p) => acc + Number(p.prima_monto), 0)

  // Agrupado por compañía (para el gráfico de barras)
  const companyMap: Record<string, { UYU: number; USD: number }> = {}
  for (const p of withMonto) {
    const name = (p.companies as any)?.name || "Sin aseguradora"
    if (!companyMap[name]) companyMap[name] = { UYU: 0, USD: 0 }
    const moneda = p.moneda === "USD" ? "USD" : "UYU"
    companyMap[name][moneda] += Number(p.prima_monto)
  }
  const byCompany = Object.entries(companyMap)
    .map(([company, totals]) => ({ company, ...totals }))
    .sort((a, b) => (b.UYU + b.USD) - (a.UYU + a.USD))

  // Agrupado por tipo (para el gráfico horizontal)
  const tipoMapUYU: Record<string, number> = {}
  const tipoMapUSD: Record<string, number> = {}
  for (const p of withMonto) {
    const tipo = p.tipo || "Desconocido"
    const moneda = p.moneda === "USD" ? "USD" : "UYU"
    if (moneda === "UYU") tipoMapUYU[tipo] = (tipoMapUYU[tipo] || 0) + Number(p.prima_monto)
    else tipoMapUSD[tipo] = (tipoMapUSD[tipo] || 0) + Number(p.prima_monto)
  }
  const byTipo = [
    ...Object.entries(tipoMapUYU).map(([tipo, total]) => ({ tipo, total, moneda: "UYU" })),
    ...Object.entries(tipoMapUSD).map(([tipo, total]) => ({ tipo, total, moneda: "USD" })),
  ].sort((a, b) => b.total - a.total)

  // Tabla detalle por compañía
  const companyDetail = Object.entries(companyMap).map(([name, totals]) => {
    const count = withMonto.filter(p => ((p.companies as any)?.name || "Sin aseguradora") === name).length
    return { name, ...totals, count }
  }).sort((a, b) => (b.UYU + b.USD) - (a.UYU + a.USD))

  return {
    totalPolicies: totalPolicies || 0,
    withMontoCount: withMonto.length,
    sinMontoCount: sinMonto,
    totalUYU,
    totalUSD,
    byCompany,
    byTipo,
    companyDetail,
  }
}

export default async function FacturacionPage() {
  const data = await getData()

  const pctCoverage = data.totalPolicies > 0
    ? Math.round((data.withMontoCount / data.totalPolicies) * 100)
    : 0

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Facturación</h1>
          <p className="text-muted-foreground">
            Primas acumuladas por pólizas con monto cargado
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prima Total UYU</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.totalUYU.toLocaleString("es-UY", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">Pesos uruguayos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prima Total USD</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.totalUSD.toLocaleString("es-UY", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">Dólares</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pólizas con Monto</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.withMontoCount}</div>
              <p className="text-xs text-muted-foreground">
                {pctCoverage}% del portafolio
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sin Dato</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{data.sinMontoCount}</div>
              <p className="text-xs text-muted-foreground">Pólizas sin monto cargado</p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid gap-6 md:grid-cols-2">
          <PrimaPorCompaniaChart data={data.byCompany} />
          <PrimaPorTipoChart data={data.byTipo} moneda="UYU" />
        </div>

        {data.totalUSD > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            <PrimaPorTipoChart data={data.byTipo} moneda="USD" />
            <div />
          </div>
        )}

        {/* Tabla de detalle por compañía */}
        <Card>
          <CardHeader>
            <CardTitle>Detalle por Aseguradora</CardTitle>
          </CardHeader>
          <CardContent>
            {data.companyDetail.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sin datos de facturación cargados aún. Cargá pólizas con monto para ver el detalle.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aseguradora</TableHead>
                    <TableHead className="text-right">Pólizas con monto</TableHead>
                    <TableHead className="text-right">Prima total UYU</TableHead>
                    <TableHead className="text-right">Prima total USD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.companyDetail.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{row.count}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.UYU > 0
                          ? `UYU ${row.UYU.toLocaleString("es-UY", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.USD > 0
                          ? `USD ${row.USD.toLocaleString("es-UY", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
