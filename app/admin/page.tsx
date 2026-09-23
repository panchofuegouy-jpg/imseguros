import Link from "next/link"
import {
  ArrowRight,
  Cake,
  CalendarClock,
  CheckCircle2,
  FileText,
  HandCoins,
  MessageCircle,
  Phone,
  ShieldAlert,
  Users,
} from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { fetchAllSupabaseRows } from "@/lib/supabase/fetch-all"
import { AdminLayout } from "@/components/admin-layout"
import { StatCard } from "@/components/brand/stat-card"
import { SectionCard } from "@/components/brand/section-card"
import { ExpiryBadge, RenewalStatusBadge } from "@/components/brand/status-badge"
import { Button } from "@/components/ui/button"
import { CompanyShareChart } from "@/components/charts/policies-by-company-chart"
import { ClientsByMonthChart } from "@/components/charts/clients-by-month-chart"
import { GreetingHeader } from "@/components/dashboard/greeting-header"
import { daysUntil, formatDateLong, formatNumber, relativeDays } from "@/lib/format"
import { generateWhatsAppBirthdayLink, generateWhatsAppRenewalLink } from "@/lib/whatsapp-share"
import { formatDebt } from "@/lib/collections"

// Siempre con datos del momento: esta pantalla es la lista de tareas del día.
export const dynamic = "force-dynamic"

const toISODate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

interface ExpiringPolicy {
  id: string
  numero_poliza: string
  tipo: string | null
  vigencia_fin: string
  status: string | null
  client_id: string
  clients: { nombre: string; telefono: string | null } | null
  companies: { name: string } | null
}

interface BirthdayClient {
  id: string
  nombre: string
  telefono: string | null
  fecha_nacimiento: string
}

interface DueDebtor {
  id: string
  display_name: string
  next_action_at: string | null
  saldo_por_moneda?: Record<string, number> | null
}

async function getData() {
  const supabase = await createClient()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in7 = new Date(today)
  in7.setDate(today.getDate() + 7)
  const in30 = new Date(today)
  in30.setDate(today.getDate() + 30)
  const lastWeek = new Date(today)
  lastWeek.setDate(today.getDate() - 7)
  const yearAgo = new Date(today.getFullYear(), today.getMonth() - 11, 1)

  const [
    totalClients,
    activePolicies,
    expiring30,
    expiringSoon,
    companyRows,
    companies,
    birthdayRows,
    recentClients,
    dueDebtors,
    openClaims,
  ] = await Promise.all([
    supabase.from("clients").select("*", { count: "exact", head: true }),
    supabase.from("policies").select("*", { count: "exact", head: true }).gte("vigencia_fin", toISODate(today)),
    supabase
      .from("policies")
      .select("*", { count: "exact", head: true })
      .gte("vigencia_fin", toISODate(today))
      .lte("vigencia_fin", toISODate(in30)),
    // Vencen en 7 días (o vencieron la semana pasada) y nadie cerró la gestión.
    supabase
      .from("policies")
      .select("id, numero_poliza, tipo, vigencia_fin, status, client_id, clients(nombre, telefono), companies(name)")
      .gte("vigencia_fin", toISODate(lastWeek))
      .lte("vigencia_fin", toISODate(in7))
      .not("status", "in", '("Renovada","No Renovada")')
      .order("vigencia_fin", { ascending: true })
      .limit(8),
    // Todas las pólizas vigentes (solo la aseguradora) para el reparto real de la cartera.
    fetchAllSupabaseRows<{ company_id: string | null }>((from, to) =>
      supabase.from("policies").select("company_id").gte("vigencia_fin", toISODate(today)).range(from, to),
    ),
    supabase.from("companies").select("id, name"),
    fetchAllSupabaseRows<BirthdayClient>((from, to) =>
      supabase
        .from("clients")
        .select("id, nombre, telefono, fecha_nacimiento")
        .not("fecha_nacimiento", "is", null)
        .range(from, to),
    ),
    fetchAllSupabaseRows<{ created_at: string }>((from, to) =>
      supabase.from("clients").select("created_at").gte("created_at", yearAgo.toISOString()).range(from, to),
    ),
    // Cobranza y siniestros son módulos nuevos: si la tabla no existe, la sección se oculta.
    supabase
      .from("collection_debtors")
      .select("id, display_name, next_action_at")
      .lte("next_action_at", new Date().toISOString())
      .not("status", "in", '("al_dia","incobrable")')
      .order("next_action_at", { ascending: true })
      .limit(5),
    supabase
      .from("claims")
      .select("*", { count: "exact", head: true })
      .not("status", "in", '("resolved","closed","archived")'),
  ])

  // Reparto de pólizas vigentes por aseguradora
  const companyNames = new Map((companies.data ?? []).map((company) => [company.id, company.name]))
  const byCompany = new Map<string, number>()
  for (const row of companyRows.data) {
    const name = (row.company_id && companyNames.get(row.company_id)) || "Sin aseguradora"
    byCompany.set(name, (byCompany.get(name) ?? 0) + 1)
  }
  const companyShare = Array.from(byCompany, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  // Cumpleaños de hoy y de los próximos 7 días
  const birthdays = birthdayRows.data
    .map((client) => {
      const [, month, day] = client.fecha_nacimiento.split("-").map(Number)
      let next = new Date(today.getFullYear(), month - 1, day)
      if (next < today) next = new Date(today.getFullYear() + 1, month - 1, day)
      const days = Math.round((next.getTime() - today.getTime()) / 86_400_000)
      return { client, days }
    })
    .filter(({ days }) => days <= 7)
    .sort((a, b) => a.days - b.days)

  return {
    totalClients: totalClients.count ?? 0,
    activePolicies: activePolicies.count ?? 0,
    expiring30: expiring30.count ?? 0,
    expiringSoon: (expiringSoon.data as unknown as ExpiringPolicy[]) ?? [],
    companyShare,
    birthdays,
    recentClients: recentClients.data,
    dueDebtors: dueDebtors.error ? null : ((dueDebtors.data as DueDebtor[]) ?? []),
    openClaims: openClaims.error ? null : (openClaims.count ?? 0),
  }
}

function TaskRow({
  href,
  title,
  subtitle,
  badge,
  actions,
}: {
  href: string
  title: string
  subtitle: string
  badge?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between">
      <Link href={href} className="group min-w-0 flex-1 space-y-1 outline-none">
        <p className="truncate text-lg font-semibold text-foreground group-hover:text-primary group-focus-visible:underline">
          {title}
        </p>
        <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
      </Link>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {badge}
        {actions}
      </div>
    </li>
  )
}

function AllClear({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 py-3 text-base text-muted-foreground">
      <CheckCircle2 className="size-6 shrink-0 text-success-strong" aria-hidden />
      {children}
    </p>
  )
}

export default async function AdminDashboard() {
  const data = await getData()
  const birthdaysToday = data.birthdays.filter((item) => item.days === 0)
  const pendingToday =
    data.expiringSoon.length + birthdaysToday.length + (data.dueDebtors ? data.dueDebtors.length : 0)

  return (
    <AdminLayout>
      <div className="space-y-8">
        <GreetingHeader pendingCount={pendingToday} />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <SectionCard
            title="Vencen esta semana"
            description="Pólizas que hay que renovar ya. Avisale al cliente y anotá en qué quedó."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/polizas/por-vencer">
                  Ver todas
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            }
          >
            {data.expiringSoon.length === 0 ? (
              <AllClear>No hay pólizas sin gestionar que venzan esta semana.</AllClear>
            ) : (
              <ul className="divide-y">
                {data.expiringSoon.map((policy) => {
                  const days = daysUntil(policy.vigencia_fin)
                  const whatsapp = generateWhatsAppRenewalLink({
                    phone: policy.clients?.telefono,
                    clientName: policy.clients?.nombre ?? "",
                    policyNumber: policy.numero_poliza,
                    policyType: policy.tipo,
                    companyName: policy.companies?.name,
                    daysLeft: days ?? 0,
                    expirationLabel: formatDateLong(policy.vigencia_fin),
                  })
                  return (
                    <TaskRow
                      key={policy.id}
                      href={`/admin/clientes/${policy.client_id}`}
                      title={policy.clients?.nombre ?? "Cliente sin nombre"}
                      subtitle={[
                        `Póliza ${policy.numero_poliza}`,
                        policy.tipo,
                        policy.companies?.name,
                        `vence ${formatDateLong(policy.vigencia_fin)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      badge={
                        <>
                          <ExpiryBadge days={days} />
                          {policy.status && policy.status !== "Pendiente" && (
                            <RenewalStatusBadge status={policy.status} />
                          )}
                        </>
                      }
                      actions={
                        whatsapp && (
                          <Button asChild size="sm" variant="outline">
                            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                              <MessageCircle aria-hidden className="text-success-strong" />
                              WhatsApp
                            </a>
                          </Button>
                        )
                      }
                    />
                  )
                })}
              </ul>
            )}
          </SectionCard>

          <div className="space-y-6">
            <SectionCard
              title="Cumpleaños"
              description={birthdaysToday.length ? "Hoy es un buen día para saludar." : "Los de esta semana."}
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/cumpleanos">
                    Ver todos
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              }
            >
              {data.birthdays.length === 0 ? (
                <AllClear>No hay cumpleaños esta semana.</AllClear>
              ) : (
                <ul className="divide-y">
                  {data.birthdays.slice(0, 5).map(({ client, days }) => {
                    const whatsapp = generateWhatsAppBirthdayLink(client.telefono, client.nombre)
                    return (
                      <TaskRow
                        key={client.id}
                        href={`/admin/clientes/${client.id}`}
                        title={client.nombre}
                        subtitle={days === 0 ? "¡Cumple hoy!" : `Cumple ${relativeDays(days)}`}
                        badge={
                          days === 0 ? (
                            <span className="grid size-9 place-items-center rounded-full bg-warning-soft text-warning-strong">
                              <Cake className="size-5" aria-label="Cumple hoy" />
                            </span>
                          ) : undefined
                        }
                        actions={
                          whatsapp &&
                          days === 0 && (
                            <Button asChild size="sm" variant="outline">
                              <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                                <MessageCircle aria-hidden className="text-success-strong" />
                                Saludar
                              </a>
                            </Button>
                          )
                        }
                      />
                    )
                  })}
                </ul>
              )}
            </SectionCard>

            {data.dueDebtors && (
              <SectionCard
                title="Cobros para hoy"
                description="Personas que quedaste en volver a contactar."
                action={
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/admin/cobranza">
                      Cobranza
                      <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                }
              >
                {data.dueDebtors.length === 0 ? (
                  <AllClear>No hay llamados de cobranza pendientes.</AllClear>
                ) : (
                  <ul className="divide-y">
                    {data.dueDebtors.map((debtor) => (
                      <TaskRow
                        key={debtor.id}
                        href={`/admin/cobranza/${debtor.id}`}
                        title={debtor.display_name}
                        subtitle={
                          debtor.saldo_por_moneda
                            ? formatDebt(debtor.saldo_por_moneda)
                            : `Contactar desde el ${formatDateLong(debtor.next_action_at)}`
                        }
                        actions={
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/cobranza/${debtor.id}`}>
                              <Phone aria-hidden />
                              Gestionar
                            </Link>
                          </Button>
                        }
                      />
                    ))}
                  </ul>
                )}
              </SectionCard>
            )}
          </div>
        </div>

        <section aria-labelledby="resumen" className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 id="resumen" className="font-display text-2xl">
              La cartera en números
            </h2>
            <span className="gold-rule" aria-hidden />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Clientes"
              value={formatNumber(data.totalClients)}
              hint="Ver la lista de clientes"
              icon={Users}
              href="/admin/clientes"
            />
            <StatCard
              label="Pólizas vigentes"
              value={formatNumber(data.activePolicies)}
              hint="Todas las pólizas"
              icon={FileText}
              href="/admin/polizas"
              tone="success"
            />
            <StatCard
              label="Vencen en 30 días"
              value={formatNumber(data.expiring30)}
              hint="Ver pólizas por vencer"
              icon={CalendarClock}
              href="/admin/polizas/por-vencer"
              tone={data.expiring30 > 0 ? "warning" : "success"}
            />
            {data.openClaims !== null ? (
              <StatCard
                label="Siniestros abiertos"
                value={formatNumber(data.openClaims)}
                hint="Ver siniestros"
                icon={ShieldAlert}
                href="/admin/siniestros"
                tone={data.openClaims > 0 ? "danger" : "success"}
              />
            ) : (
              <StatCard
                label="Cobranza"
                value="—"
                hint="Ir a cobranza"
                icon={HandCoins}
                href="/admin/cobranza"
              />
            )}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <CompanyShareChart data={data.companyShare} />
          <ClientsByMonthChart clients={data.recentClients} />
        </div>
      </div>
    </AdminLayout>
  )
}
