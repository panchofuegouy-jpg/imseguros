import { z } from "zod"

/** Estado contable de la cuota. */
export const collectionStatuses = [
  "new", "open", "contacted", "promise_to_pay", "partially_paid", "paid", "disputed", "not_renewed", "archived",
] as const
export type CollectionStatus = (typeof collectionStatuses)[number]

/**
 * Estado de gestión del deudor. Es la columna del tablero y no tiene que ver
 * con el estado contable: alguien puede estar en "promesa" con una cuota
 * parcialmente pagada y otra vencida.
 */
export const debtorStatuses = ["sin_gestionar", "contactado", "promesa", "no_renovo", "incobrable", "al_dia"] as const
export type DebtorStatus = (typeof debtorStatuses)[number]

export const DEBTOR_COLUMNS: { value: DebtorStatus; label: string; hint: string }[] = [
  { value: "sin_gestionar", label: "Sin gestionar", hint: "Entraron por importación o alta y nadie los contactó" },
  { value: "contactado", label: "Contactado", hint: "Ya se habló, sin compromiso de pago" },
  { value: "promesa", label: "Promesa de pago", hint: "Se comprometió a una fecha" },
  { value: "no_renovo", label: "No renovó", hint: "Dio de baja la póliza con deuda pendiente" },
  { value: "incobrable", label: "Incobrable", hint: "Se dejó de gestionar" },
  { value: "al_dia", label: "Al día", hint: "Sin saldo pendiente" },
]

export const DEBTOR_STATUS_LABELS = Object.fromEntries(
  DEBTOR_COLUMNS.map((column) => [column.value, column.label]),
) as Record<DebtorStatus, string>

export const obligationInputSchema = z.object({
  company_id: z.string().uuid(),
  client_id: z.string().uuid().nullable().optional(),
  policy_id: z.string().uuid().nullable().optional(),
  external_reference: z.string().trim().max(160).nullable().optional(),
  due_date: z.string().date(),
  amount: z.number().nonnegative(),
  currency: z.enum(["UYU", "USD"]).default("UYU"),
  installment_number: z.number().int().positive().nullable().optional(),
  status: z.enum(collectionStatuses).default("new"),
}).superRefine((value, ctx) => {
  if (!value.client_id && !value.policy_id && !value.external_reference) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Indicá cliente, póliza o referencia externa", path: ["external_reference"] })
  }
})

export const obligationPatchSchema = z.object({
  status: z.enum(collectionStatuses).optional(),
  due_date: z.string().date().optional(),
  external_reference: z.string().trim().max(160).nullable().optional(),
  reason: z.string().trim().max(2000).optional(),
}).strict()

export const paymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(["UYU", "USD"]),
  paid_at: z.string().datetime().optional(),
  reference: z.string().trim().max(160).optional(),
  note: z.string().trim().max(2000).optional(),
  idempotency_key: z.string().trim().min(16).max(160),
})

export const contactSchema = z.object({
  channel: z.enum(["telefono", "email", "presencial", "otro"]),
  outcome: z.enum(["contactado", "promesa", "pagó", "no_renovó", "baja"]),
  note: z.string().trim().max(2000).optional(),
  next_action_at: z.string().datetime().optional(),
  obligation_id: z.string().uuid().optional(),
})

export const debtorTransitionSchema = z.object({
  status: z.enum(debtorStatuses),
  note: z.string().trim().max(2000).optional(),
  next_action_at: z.string().datetime().optional(),
}).superRefine((value, ctx) => {
  if (["no_renovo", "incobrable"].includes(value.status) && !value.note?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Dar por no renovado o incobrable exige una nota", path: ["note"] })
  }
})

export type DebtorSummary = {
  id: string
  display_name: string
  document: string | null
  status: DebtorStatus
  client_id: string | null
  assignee_id: string | null
  next_action_at: string | null
  last_contact_at: string | null
  cuotas: number
  cuotas_vencidas: number
  polizas: number
  saldo_por_moneda: Record<string, number>
  vencimiento_mas_antiguo: string | null
}

/** Un deudor entra en la cola del día si su próximo paso ya venció. */
export function isDueForContact(debtor: Pick<DebtorSummary, "next_action_at">, now = new Date()) {
  if (!debtor.next_action_at) return false
  return new Date(debtor.next_action_at).getTime() <= now.getTime()
}

export function formatDebt(saldo: Record<string, number> | null | undefined) {
  const entries = Object.entries(saldo || {}).filter(([, total]) => Number(total) > 0)
  if (entries.length === 0) return "Sin saldo"
  return entries
    .map(([currency, total]) => new Intl.NumberFormat("es-UY", { style: "currency", currency }).format(Number(total)))
    .join(" · ")
}

export function collectionSelect() {
  return "*, clients(id, nombre, documento), policies(id, numero_poliza), companies(id, name)"
}
