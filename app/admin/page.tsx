"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, Calendar, TrendingUp } from "lucide-react"
import { AdminLayout } from "@/components/admin-layout"

interface DashboardStats {
  totalClients: number
  totalPolicies: number
  activePolicies: number
  expiringPolicies: number
}

export default function AdminDashboard() {
  console.log("AdminDashboard component rendering...");
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    totalPolicies: 0,
    activePolicies: 0,
    expiringPolicies: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        // Get total clients
        console.log("Fetching total clients...");
        const { count: clientCount, error: clientError } = await supabase.from("clients").select("*", { count: "exact", head: true });
        if (clientError) console.error("Error fetching client count:", clientError);
        console.log("Total clients:", clientCount);

        // Get total policies
        console.log("Fetching total policies...");
        const { count: policyCount, error: policyError } = await supabase.from("policies").select("*", { count: "exact", head: true });
        if (policyError) console.error("Error fetching policy count:", policyError);
        console.log("Total policies:", policyCount);

        // Get active policies (not expired)
        console.log("Fetching active policies...");
        const today = new Date().toISOString().split("T")[0];
        const { count: activeCount, error: activeError } = await supabase
          .from("policies")
          .select("*", { count: "exact", head: true })
          .gte("vigencia_fin", today);
        if (activeError) console.error("Error fetching active policies:", activeError);
        console.log("Active policies:", activeCount);

        // Get policies expiring in next 30 days
        console.log("Fetching expiring policies...");
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const { count: expiringCount, error: expiringError } = await supabase
          .from("policies")
          .select("*", { count: "exact", head: true })
          .gte("vigencia_fin", today)
          .lte("vigencia_fin", thirtyDaysFromNow.toISOString().split("T")[0]);
        if (expiringError) console.error("Error fetching expiring policies:", expiringError);
        console.log("Expiring policies:", expiringCount);

        setStats({
          totalClients: clientCount || 0,
          totalPolicies: policyCount || 0,
          activePolicies: activeCount || 0,
          expiringPolicies: expiringCount || 0,
        })
      } catch (error) {
        console.error("Error fetching stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Resumen general del sistema de gestión de pólizas</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
              <p className="text-xs text-muted-foreground">Clientes registrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pólizas</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPolicies}</div>
              <p className="text-xs text-muted-foreground">Pólizas en el sistema</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pólizas Activas</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activePolicies}</div>
              <p className="text-xs text-muted-foreground">Vigentes actualmente</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Por Vencer</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.expiringPolicies}</div>
              <p className="text-xs text-muted-foreground">Próximos 30 días</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Acciones Rápidas</CardTitle>
              <CardDescription>Tareas comunes del administrador</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                <Users className="h-4 w-4" />
                <a href="/admin/clientes" className="text-blue-600 hover:underline">
                  Gestionar Clientes
                </a>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <FileText className="h-4 w-4" />
                <a href="/admin/polizas" className="text-blue-600 hover:underline">
                  Ver Todas las Pólizas
                </a>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span className="text-muted-foreground">Revisar Vencimientos</span>
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
