import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminLayout } from "@/components/admin-layout"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DebtorActions } from "@/components/operations/debtor-actions"
import { DEBTOR_STATUS_LABELS, formatDebt, type DebtorStatus } from "@/lib/collections"

const OBLIGATION_LABELS: Record<string, string> = {
  new: "Nueva", open: "Abierta", contacted: "Contactada", promise_to_pay: "Promesa de pago",
  partially_paid: "Pago parcial", paid: "Pagada", disputed: "Disputada",
  not_renewed: "No renovada", archived: "Archivada",
}
const OUTCOME_LABELS: Record<string, string> = {
  contactado: "Contactado", promesa: "Promesa de pago", "pagó": "Pagó",
  "no_renovó": "No renovó", baja: "Baja",
}

function money(value: number | null | undefined, currency = "UYU") {
  if (value == null) return "—"
  return new Intl.NumberFormat("es-UY", { style: "currency", currency }).format(Number(value))
}

export default async function DebtorDetailPage({ params }: { params: Promise<{ debtorId: string }> }) {
  const { debtorId } = await params
  const supabase = await createClient()

  const { data: debtor } = await supabase
    .from("collection_debtor_summary").select("*").eq("id", debtorId).maybeSingle()
  if (!debtor) notFound()

  const [{ data: obligations }, { data: contacts }] = await Promise.all([
    supabase
      .from("collection_obligations")
      .select("id, due_date, amount, balance, currency, installment_number, status, external_reference, policies(id, numero_poliza), companies(id, name)")
      .eq("debtor_id", debtorId)
      .order("due_date", { ascending: true }),
    supabase
      .from("collection_contacts")
      .select("id, channel, outcome, note, next_action_at, created_at")
      .eq("debtor_id", debtorId)
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  const cuotas = obligations || []
  const historial = contacts || []
  const pendientes = cuotas.filter((row: any) => !["paid", "archived"].includes(row.status))
  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <Link className="text-sm text-primary underline" href="/admin/cobranza">← Volver al tablero</Link>
          <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h1 className="text-3xl font-bold">{debtor.display_name}</h1>
              <p className="text-muted-foreground">
                {debtor.document ? `Doc. ${debtor.document}` : "Sin documento"}
                {debtor.client_id && (
                  <>
                    {" · "}
                    <Link className="underline" href={`/admin/clientes/${debtor.client_id}`}>Ver ficha del cliente</Link>
                  </>
                )}
              </p>
            </div>
            <Badge variant="outline" className="self-start text-sm">
              {DEBTOR_STATUS_LABELS[debtor.status as DebtorStatus] || debtor.status}
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Deuda total</CardTitle></CardHeader>
            <CardContent>
              <strong className="text-2xl">{formatDebt(debtor.saldo_por_moneda)}</strong>
              <p className="text-xs text-muted-foreground">
                {debtor.cuotas} cuotas en {debtor.polizas} {debtor.polizas === 1 ? "póliza" : "pólizas"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Vencidas</CardTitle></CardHeader>
            <CardContent>
              <strong className={`text-2xl ${debtor.cuotas_vencidas > 0 ? "text-destructive" : ""}`}>
                {debtor.cuotas_vencidas}
              </strong>
              <p className="text-xs text-muted-foreground">
                {debtor.vencimiento_mas_antiguo ? `Más antigua: ${debtor.vencimiento_mas_antiguo}` : "Sin vencimientos"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Próximo paso</CardTitle></CardHeader>
            <CardContent>
              <strong className="text-2xl">
                {debtor.next_action_at ? new Date(debtor.next_action_at).toLocaleDateString("es-UY") : "—"}
              </strong>
              <p className="text-xs text-muted-foreground">
                {debtor.last_contact_at
                  ? `Último contacto: ${new Date(debtor.last_contact_at).toLocaleDateString("es-UY")}`
                  : "Sin gestiones aún"}
              </p>
            </CardContent>
          </Card>
        </div>

        <DebtorActions debtorId={debtorId} obligations={pendientes.map((row: any) => ({
          id: row.id,
          label: `${row.installment_number ? `Cuota ${row.installment_number}` : "Cuota"} · vence ${row.due_date} · ${money(row.balance, row.currency)}`,
          currency: row.currency,
          balance: Number(row.balance),
        }))} />

        <Card>
          <CardHeader><CardTitle>Cuotas ({cuotas.length})</CardTitle></CardHeader>
          <CardContent>
            {cuotas.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">Este deudor no tiene cuotas registradas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-3">Cuota</th><th className="p-3">Compañía</th><th className="p-3">Póliza</th>
                      <th className="p-3">Vence</th><th className="p-3 text-right">Importe</th>
                      <th className="p-3 text-right">Saldo</th><th className="p-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuotas.map((row: any) => (
                      <tr key={row.id} className="border-b">
                        <td className="p-3">{row.installment_number ? `Cuota ${row.installment_number}` : row.external_reference || "—"}</td>
                        <td className="p-3">{row.companies?.name || "—"}</td>
                        <td className="p-3">{row.policies?.numero_poliza || "—"}</td>
                        <td className={`p-3 ${row.due_date < hoy && !["paid", "archived"].includes(row.status) ? "font-medium text-destructive" : ""}`}>
                          {row.due_date}
                        </td>
                        <td className="p-3 text-right">{money(row.amount, row.currency)}</td>
                        <td className="p-3 text-right font-medium">{money(row.balance, row.currency)}</td>
                        <td className="p-3">
                          <Badge variant={row.status === "paid" ? "secondary" : "outline"}>
                            {OBLIGATION_LABELS[row.status] || row.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Historial de gestiones</CardTitle></CardHeader>
          <CardContent>
            {historial.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">Todavía no se registró ninguna gestión con esta persona.</p>
            ) : (
              <ol className="space-y-4">
                {historial.map((item: any) => (
                  <li key={item.id} className="border-l-2 pl-4">
                    <p className="font-medium">{OUTCOME_LABELS[item.outcome] || item.outcome}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(item.created_at).toLocaleString("es-UY")} · {item.channel}
                      {item.next_action_at && ` · vuelve el ${new Date(item.next_action_at).toLocaleDateString("es-UY")}`}
                    </p>
                    {item.note && <p className="mt-1 text-sm">{item.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
