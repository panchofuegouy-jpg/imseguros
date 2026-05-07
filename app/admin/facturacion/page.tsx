import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminLayout } from "@/components/admin-layout"
import { PrimaPorCompaniaChart } from "@/components/charts/prima-por-compania-chart"
import { PrimaPorTipoChart } from "@/components/charts/prima-por-tipo-chart"
import { PrimaEvolucionChart } from "@/components/charts/prima-evolucion-chart"
import { FacturacionFilters } from "@/components/facturacion-filters"
import { DollarSign, TrendingUp, FileText, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Suspense } from "react"

const PAGE_SIZE = 50

type Periodo = "mensual" | "trimestral" | "anual" | "total"

function getDateRange(periodo: Periodo): { from: string | null; to: string | null } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  if (periodo === "mensual") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { from: fmt(from), to: fmt(to) }
  }
  if (periodo === "trimestral") {
    const from = new Date(now)
    from.setMonth(from.getMonth() - 2)
    from.setDate(1)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { from: fmt(from), to: fmt(to) }
  }
  if (periodo === "anual") {
    return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }
  }
  return { from: null, to: null }
}

// Agrupa por etiqueta de período para el gráfico de evolución
function groupByPeriodo(policies: any[], periodo: Periodo) {
  const map: Record<string, { UYU: number; USD: number }> = {}

  for (const p of policies) {
    if (p.prima_monto == null) continue
    const d = new Date(p.vigencia_inicio || p.created_at)
    if (isNaN(d.getTime())) continue

    let key: string
    if (periodo === "mensual") {
      // Agrupar por día dentro del mes
      key = `${d.getDate()}/${d.getMonth() + 1}`
    } else if (periodo === "trimestral") {
      // Agrupar por semana
      const week = Math.ceil(d.getDate() / 7)
      key = `S${week} ${d.toLocaleString("es-UY", { month: "short" })}`
    } else {
      // Agrupar por mes (anual o total)
      key = d.toLocaleString("es-UY", { month: "short", year: "2-digit" })
    }

    if (!map[key]) map[key] = { UYU: 0, USD: 0 }
    map[key][p.moneda === "USD" ? "USD" : "UYU"] += Number(p.prima_monto)
  }

  return Object.entries(map).map(([periodo, totals]) => ({ periodo, ...totals }))
}

function evolucionTitulo(periodo: Periodo) {
  if (periodo === "mensual")    return "Primas este mes por día"
  if (periodo === "trimestral") return "Primas por semana (últimos 3 meses)"
  if (periodo === "anual")      return "Primas por mes (este año)"
  return "Primas por mes (histórico)"
}

async function getAllPolicies(periodo: Periodo) {
  const supabase = await createClient()
  const { from, to } = getDateRange(periodo)

  const pages: any[] = []
  let offset = 0
  while (true) {
    let q = supabase
      .from("policies")
      .select("prima_monto, moneda, tipo, vigencia_inicio, created_at, companies(name)")
      .range(offset, offset + 999)

    if (from) q = q.gte("vigencia_inicio", from)
    if (to)   q = q.lte("vigencia_inicio", to)

    const { data, error } = await q
    if (error || !data || data.length === 0) break
    pages.push(...data)
    if (data.length < 1000) break
    offset += 1000
  }
  return pages
}

async function getData(periodo: Periodo, page: number) {
  const supabase = await createClient()
  const { from, to } = getDateRange(periodo)

  const [allPolicies, totalCount] = await Promise.all([
    getAllPolicies(periodo),
    supabase.from("policies").select("*", { count: "exact", head: true }).then(r => r.count || 0),
  ])

  const withMonto = allPolicies.filter(p => p.prima_monto != null)

  const totalUYU = withMonto.filter(p => (p.moneda || "UYU") === "UYU").reduce((a, p) => a + Number(p.prima_monto), 0)
  const totalUSD = withMonto.filter(p => p.moneda === "USD").reduce((a, p) => a + Number(p.prima_monto), 0)

  // Por compañía
  const companyMap: Record<string, { UYU: number; USD: number }> = {}
  for (const p of withMonto) {
    const name = (p.companies as any)?.name || "Sin aseguradora"
    if (!companyMap[name]) companyMap[name] = { UYU: 0, USD: 0 }
    companyMap[name][p.moneda === "USD" ? "USD" : "UYU"] += Number(p.prima_monto)
  }
  const byCompany = Object.entries(companyMap)
    .map(([company, t]) => ({ company, ...t }))
    .sort((a, b) => (b.UYU + b.USD) - (a.UYU + a.USD))

  // Por tipo
  const tipoMapUYU: Record<string, number> = {}
  const tipoMapUSD: Record<string, number> = {}
  for (const p of withMonto) {
    const tipo = p.tipo || "Desconocido"
    if (p.moneda === "USD") tipoMapUSD[tipo] = (tipoMapUSD[tipo] || 0) + Number(p.prima_monto)
    else tipoMapUYU[tipo] = (tipoMapUYU[tipo] || 0) + Number(p.prima_monto)
  }
  const byTipo = [
    ...Object.entries(tipoMapUYU).map(([tipo, total]) => ({ tipo, total, moneda: "UYU" })),
    ...Object.entries(tipoMapUSD).map(([tipo, total]) => ({ tipo, total, moneda: "USD" })),
  ].sort((a, b) => b.total - a.total)

  const companyDetail = Object.entries(companyMap).map(([name, t]) => {
    const count = withMonto.filter(p => ((p.companies as any)?.name || "Sin aseguradora") === name).length
    return { name, ...t, count }
  }).sort((a, b) => (b.UYU + b.USD) - (a.UYU + a.USD))

  // Evolución temporal
  const evolucion = groupByPeriodo(allPolicies, periodo)

  // Tabla paginada (sin filtro de fecha para ver todo)
  const offset = page * PAGE_SIZE
  let tableQuery = supabase
    .from("policies")
    .select("id, numero_poliza, nombre_asegurado, prima_monto, moneda, forma_pago, tipo, companies(name)")
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (from) tableQuery = tableQuery.gte("vigencia_inicio", from)
  if (to)   tableQuery = tableQuery.lte("vigencia_inicio", to)

  const { data: tablePolicies } = await tableQuery

  // Count filtrado para paginación
  let countQuery = supabase.from("policies").select("*", { count: "exact", head: true })
  if (from) countQuery = countQuery.gte("vigencia_inicio", from)
  if (to)   countQuery = countQuery.lte("vigencia_inicio", to)
  const { count: filteredCount } = await countQuery

  return {
    totalPolicies: totalCount,
    filteredCount: filteredCount || 0,
    withMontoCount: withMonto.length,
    sinMontoCount: totalCount - withMonto.length,
    totalUYU,
    totalUSD,
    byCompany,
    byTipo,
    companyDetail,
    evolucion,
    tablePolicies: tablePolicies || [],
    totalPages: Math.ceil((filteredCount || 0) / PAGE_SIZE),
  }
}

export default async function FacturacionPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; page?: string }>
}) {
  const params = await searchParams
  const periodo = (params.periodo || "total") as Periodo
  const page = Math.max(0, parseInt(params.page || "0", 10))

  const data = await getData(periodo, page)

  const pctCoverage = data.totalPolicies > 0
    ? Math.round((data.withMontoCount / data.totalPolicies) * 100)
    : 0

  const periodoLabel: Record<Periodo, string> = {
    mensual: "este mes",
    trimestral: "últimos 3 meses",
    anual: "este año",
    total: "total acumulado",
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header + filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Facturación</h1>
            <p className="text-muted-foreground">
              Primas — {periodoLabel[periodo]}
            </p>
          </div>
          <Suspense>
            <FacturacionFilters />
          </Suspense>
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
                {pctCoverage}% del portafolio total
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

        {/* Gráfico evolución temporal */}
        <PrimaEvolucionChart data={data.evolucion} titulo={evolucionTitulo(periodo)} />

        {/* Gráficos por compañía y tipo */}
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

        {/* Tabla pólizas individuales */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pólizas — Detalle de Facturación</CardTitle>
            <span className="text-sm text-muted-foreground">
              {data.filteredCount} pólizas · página {page + 1} de {data.totalPages || 1}
            </span>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Póliza</TableHead>
                  <TableHead>Asegurado</TableHead>
                  <TableHead>Aseguradora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Forma de pago</TableHead>
                  <TableHead className="text-right">Total a pagar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.tablePolicies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Sin pólizas para el período seleccionado
                    </TableCell>
                  </TableRow>
                ) : (
                  data.tablePolicies.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-sm">{p.numero_poliza || "—"}</TableCell>
                      <TableCell>{p.nombre_asegurado || "—"}</TableCell>
                      <TableCell>{(p.companies as any)?.name || "—"}</TableCell>
                      <TableCell>{p.tipo || "—"}</TableCell>
                      <TableCell>
                        {p.forma_pago || <span className="text-muted-foreground text-xs">Sin dato</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {p.prima_monto != null
                          ? <span>{p.moneda || "UYU"} {Number(p.prima_monto).toLocaleString("es-UY", { minimumFractionDigits: 2 })}</span>
                          : <Badge variant="outline" className="text-muted-foreground">Sin monto</Badge>
                        }
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="flex items-center justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" asChild disabled={page === 0}>
                <Link href={`?periodo=${periodo}&page=${page - 1}`}>
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild disabled={page >= (data.totalPages - 1)}>
                <Link href={`?periodo=${periodo}&page=${page + 1}`}>
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Detalle por aseguradora */}
        <Card>
          <CardHeader>
            <CardTitle>Detalle por Aseguradora</CardTitle>
          </CardHeader>
          <CardContent>
            {data.companyDetail.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sin datos de facturación para el período seleccionado.
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
                        {row.UYU > 0 ? `UYU ${row.UYU.toLocaleString("es-UY", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.USD > 0 ? `USD ${row.USD.toLocaleString("es-UY", { minimumFractionDigits: 2 })}` : "—"}
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
