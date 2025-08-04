import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Calendar, AlertTriangle, CheckCircle } from "lucide-react"

async function getClientStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      totalPolicies: 0,
      activePolicies: 0,
      expiringPolicies: 0,
      expiredPolicies: 0
    }
  }

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("client_id")
    .eq("id", user.id)
    .single()

  if (!profileData?.client_id) {
    return {
      totalPolicies: 0,
      activePolicies: 0,
      expiringPolicies: 0,
      expiredPolicies: 0
    }
  }

  const today = new Date().toISOString().split("T")[0]
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  // Total pólizas
  const { count: totalPolicies } = await supabase
    .from("policies")
    .select("*", { count: "exact", head: true })
    .eq("client_id", profileData.client_id)

  // Pólizas activas (vigencia_fin >= hoy)
  const { count: activePolicies } = await supabase
    .from("policies")
    .select("*", { count: "exact", head: true })
    .eq("client_id", profileData.client_id)
    .gte("vigencia_fin", today)

  // Pólizas por vencer (próximos 30 días)
  const { count: expiringPolicies } = await supabase
    .from("policies")
    .select("*", { count: "exact", head: true })
    .eq("client_id", profileData.client_id)
    .gte("vigencia_fin", today)
    .lte("vigencia_fin", thirtyDaysFromNow.toISOString().split("T")[0])

  // Pólizas vencidas
  const { count: expiredPolicies } = await supabase
    .from("policies")
    .select("*", { count: "exact", head: true })
    .eq("client_id", profileData.client_id)
    .lt("vigencia_fin", today)

  return {
    totalPolicies: totalPolicies || 0,
    activePolicies: activePolicies || 0,
    expiringPolicies: expiringPolicies || 0,
    expiredPolicies: expiredPolicies || 0
  }
}

export default async function ClientStats() {
  const stats = await getClientStats()

  const statsCards = [
    {
      title: "Total Pólizas",
      value: stats.totalPolicies,
      description: "Pólizas registradas",
      icon: FileText,
      color: "text-primary"
    },
    {
      title: "Pólizas Activas",
      value: stats.activePolicies,
      description: "Vigentes actualmente",
      icon: CheckCircle,
      color: "text-primary"
    },
    {
      title: "Por Vencer",
      value: stats.expiringPolicies,
      description: "Próximos 30 días",
      icon: Calendar,
      color: stats.expiringPolicies > 0 ? "text-destructive" : "text-muted-foreground"
    },
    {
      title: "Vencidas",
      value: stats.expiredPolicies,
      description: "Requieren renovación",
      icon: AlertTriangle,
      color: stats.expiredPolicies > 0 ? "text-destructive" : "text-muted-foreground"
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statsCards.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
