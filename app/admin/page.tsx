import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, Calendar, TrendingUp } from "lucide-react"
import { AdminLayout } from "@/components/admin-layout"
import { PoliciesByCompanyChart } from "@/components/charts/policies-by-company-chart"
import { ClientsByMonthChart } from "@/components/charts/clients-by-month-chart"

async function getData() {
  const supabase = await createClient()
  const today = new Date().toISOString().split("T")[0]
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const { count: totalClients, data: clients } = await supabase.from("clients").select("id, created_at", { count: "exact" })
  const { count: totalPolicies, data: policies } = await supabase.from("policies").select("id, company_id", { count: "exact" })
  const { count: activePolicies } = await supabase
    .from("policies")
    .select("*", { count: "exact", head: true })
    .gte("vigencia_fin", today)
  const { count: expiringPolicies } = await supabase
    .from("policies")
    .select("*", { count: "exact", head: true })
    .gte("vigencia_fin", today)
    .lte("vigencia_fin", thirtyDaysFromNow.toISOString().split("T")[0])
  
  const { data: companies } = await supabase.from("companies").select("id, name")

  return {
    totalClients: totalClients || 0,
    totalPolicies: totalPolicies || 0,
    activePolicies: activePolicies || 0,
    expiringPolicies: expiringPolicies || 0,
    policies: policies || [],
    companies: companies || [],
    clients: clients || [],
  }
}

export default async function AdminDashboard() {
  const data = await getData()

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Resumen general del sistema de gestión de pólizas</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <a href="/admin/clientes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totalClients}</div>
                <p className="text-xs text-muted-foreground">Clientes registrados</p>
              </CardContent>
            </Card>
          </a>

          <a href="/admin/polizas">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Pólizas</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.totalPolicies}</div>
                <p className="text-xs text-muted-foreground">Pólizas en el sistema</p>
              </CardContent>
            </Card>
          </a>

          <a href="/admin/polizas?status=active">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pólizas Activas</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.activePolicies}</div>
                <p className="text-xs text-muted-foreground">Vigentes actualmente</p>
              </CardContent>
            </Card>
          </a>

          <a href="/admin/polizas/por-vencer">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Por Vencer</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{data.expiringPolicies}</div>
                <p className="text-xs text-muted-foreground">Próximos 30 días</p>
              </CardContent>
            </Card>
          </a>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <PoliciesByCompanyChart policies={data.policies} companies={data.companies} />
          <ClientsByMonthChart clients={data.clients} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Acciones Rápidas</CardTitle>
              <CardDescription>Tareas comunes del administrador</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                <Users className="h-4 w-4" />
                <a href="/admin/clientes" className="text-primary hover:underline">
                  Gestionar Clientes
                </a>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <FileText className="h-4 w-4" />
                <a href="/admin/polizas" className="text-primary hover:underline">
                  Ver Todas las Pólizas
                </a>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Calendar className="h-4 w-4" />
                <a href="/admin/polizas/por-vencer" className="text-primary hover:underline">
                  Revisar Vencimientos
                </a>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Actividad Reciente</CardTitle>
              <CardDescription>Últimas acciones en el sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Sistema iniciado correctamente</p>
                <p>• Base de datos conectada</p>
                <p>• Listo para gestionar pólizas</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}

