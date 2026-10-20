/**
 * Propuestas de renovación a partir del export de BSE
 * (Portal del Asesor › Consulta de Cotizaciones › «Exportar resultados a Excel»).
 *
 * Funciones puras: se usan igual en el navegador (vista previa) y en el servidor
 * (que siempre vuelve a calcular; nunca confía en lo que manda el navegador).
 *
 * Cálculo, validado contra BSE el 19/10/2026 con 5 pólizas reales (diferencia de
 * $ 1 a $ 7 por póliza, porque BSE redondea las cuotas):
 *   C = Premio Cotización (lo que BSE cotiza para la renovación)
 *   P = Premio Póliza (lo que paga hoy el cliente)
 *   objetivo = P × (1 + aumento%)
 *   bonificación = (1 − objetivo / C) × 100, redondeada a 2 decimales
 *   premio propuesto = C × (1 − bonificación / 100)
 * La bonificación comercial de BSE solo baja el premio: si C ya está por debajo
 * del objetivo, no se bonifica y queda la cotización de BSE.
 */
import { z } from "zod"

export const BSE_EXPORT_HEADERS = {
  cotizacion: "Cotización",
  poliza: "Póliza",
  cliente: "Nombre del Cliente",
  desde: "Fecha Desde",
  hasta: "Fecha Hasta",
  moneda: "Moneda",
  planPago: "Plan de pago",
  premioCotizacion: "Premio Cotización",
  premioPoliza: "Premio Póliza",
} as const

/** Bonificación máxima que BSE acepta (más de esto la cotización es inválida). */
export const BSE_MAX_BONIFICACION = 50
/** Por encima de esto BSE la marca «fuera de pauta» y pide autorización. */
export const BSE_PAUTA_BONIFICACION = 10

export const bseRowSchema = z.object({
  cotizacion: z.string().regex(/^\d{1,12}$/),
  poliza: z.string().regex(/^\d{0,12}$/),
  cliente: z.string().trim().max(200),
  desde: z.string().trim().max(20),
  hasta: z.string().trim().max(20),
  moneda: z.string().trim().max(10),
  planPago: z.string().trim().max(80),
  premioCotizacion: z.number().nonnegative().max(1e9).nullable(),
  premioPoliza: z.number().nonnegative().max(1e9).nullable(),
})
export type BseRow = z.infer<typeof bseRowSchema>

export const bseRowsSchema = z.array(bseRowSchema).min(1).max(5000)

export type ProposalItemStatus =
  | "ajustar" // se carga la bonificación y queda en P × (1 + aumento)
  | "no_alcanza" // C ya está por debajo del objetivo: queda la cotización de BSE
  | "revisar" // la bonificación daría más de 50 %: BSE no la acepta, revisar a mano
  | "sin_datos" // falta C o P (por ejemplo, la cotización ya se editó en BSE)

export type ProposalItem = {
  numero_cotizacion: string
  numero_poliza: string
  plan_pago: string
  desde: string
  hasta: string
  moneda: string
  premio_poliza: number | null
  premio_cotizacion: number | null
  aumento_pct: number
  bonificacion_pct: number | null
  premio_propuesto: number | null
  variacion_pct: number | null
  fuera_de_pauta: boolean
  estado: ProposalItemStatus
}

const round2 = (value: number) => Math.round(value * 100) / 100

export function computeProposalItem(row: BseRow, aumentoPct: number): ProposalItem {
  const base = {
    numero_cotizacion: row.cotizacion,
    numero_poliza: row.poliza,
    plan_pago: row.planPago,
    desde: row.desde,
    hasta: row.hasta,
    moneda: row.moneda,
    premio_poliza: row.premioPoliza,
    premio_cotizacion: row.premioCotizacion,
    aumento_pct: aumentoPct,
  }
  const C = row.premioCotizacion
  const P = row.premioPoliza
  if (!isPesos(row.moneda)) {
    // Las propuestas suman en pesos: una póliza en dólares se revisa a mano.
    return { ...base, bonificacion_pct: null, premio_propuesto: null, variacion_pct: null, fuera_de_pauta: false, estado: "revisar" }
  }
  if (!C || !P) {
    return { ...base, bonificacion_pct: null, premio_propuesto: null, variacion_pct: null, fuera_de_pauta: false, estado: "sin_datos" }
  }
  const objetivo = P * (1 + aumentoPct / 100)
  const bonificacion = round2((1 - objetivo / C) * 100)
  if (bonificacion <= 0) {
    return { ...base, bonificacion_pct: 0, premio_propuesto: C, variacion_pct: round2((C / P - 1) * 100), fuera_de_pauta: false, estado: "no_alcanza" }
  }
  if (bonificacion > BSE_MAX_BONIFICACION) {
    return { ...base, bonificacion_pct: bonificacion, premio_propuesto: null, variacion_pct: null, fuera_de_pauta: true, estado: "revisar" }
  }
  const propuesto = round2(C * (1 - bonificacion / 100))
  return {
    ...base,
    bonificacion_pct: bonificacion,
    premio_propuesto: propuesto,
    variacion_pct: round2((propuesto / P - 1) * 100),
    fuera_de_pauta: bonificacion > BSE_PAUTA_BONIFICACION,
    estado: "ajustar",
  }
}

/** Ítems que van al PDF del cliente: los que tienen un premio propuesto. */
export function itemsForClient(items: ProposalItem[]) {
  return items.filter((item) => item.premio_propuesto !== null && item.premio_poliza !== null)
}

export function proposalTotals(items: ProposalItem[]) {
  const shown = itemsForClient(items)
  const actual = round2(shown.reduce((sum, item) => sum + (item.premio_poliza || 0), 0))
  const propuesto = round2(shown.reduce((sum, item) => sum + (item.premio_propuesto || 0), 0))
  return { actual, propuesto, variacion_pct: actual ? round2((propuesto / actual - 1) * 100) : null }
}

// --- Lectura del export ----------------------------------------------------------

function cellText(value: unknown) {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) {
    // Fecha real de Excel (leída con cellDates): la pasamos al formato del export de BSE.
    const dd = String(value.getUTCDate()).padStart(2, "0")
    const mm = String(value.getUTCMonth() + 1).padStart(2, "0")
    return `${dd}-${mm}-${value.getUTCFullYear()}`
  }
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(value)
  return String(value).trim()
}

/** Solo dígitos y sin ceros adelante: así se comparan los números de póliza y cotización. */
export function normalizeNumber(value: unknown) {
  const digits = cellText(value).replace(/\.0+$/, "").replace(/\D/g, "").replace(/^0+(?=\d)/, "")
  return digits
}

function normalizeHeader(value: unknown) {
  return cellText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase()
}

function cellNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  // Por si viniera como texto con formato uruguayo: «78.128,00»
  const text = String(value).trim().replace(/\$|\s/g, "")
  if (!text) return null
  let normalized: string
  if (/,\d{1,2}$/.test(text)) normalized = text.replace(/\./g, "").replace(",", ".") // 78.128,00
  else if (/^\d{1,3}(\.\d{3})+$/.test(text)) normalized = text.replace(/\./g, "") // 78.128
  else normalized = text.replace(/,/g, "") // 78128 · 78128.5
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

/**
 * Convierte la hoja (matriz de celdas, la primera fila es el encabezado) en filas BSE.
 * Tira error claro si no es el export de Consulta de Cotizaciones.
 */
export function parseBseSheet(matrix: unknown[][]): { rows: BseRow[]; skipped: number } {
  if (!matrix.length) throw new Error("El archivo está vacío.")
  const wanted = Object.fromEntries(Object.entries(BSE_EXPORT_HEADERS).map(([key, label]) => [key, normalizeHeader(label)]))
  // El encabezado puede no estar en la primera fila (algunos exports traen un título arriba).
  let headerRow = -1
  let index = {} as Record<keyof typeof BSE_EXPORT_HEADERS, number>
  for (let r = 0; r < Math.min(matrix.length, 10); r += 1) {
    const header = (matrix[r] || []).map(normalizeHeader)
    const candidate = Object.fromEntries(Object.entries(wanted).map(([key, label]) => [key, header.indexOf(label)])) as typeof index
    if (candidate.cotizacion >= 0 && candidate.premioCotizacion >= 0) { headerRow = r; index = candidate; break }
  }
  const missing = headerRow < 0
    ? Object.values(BSE_EXPORT_HEADERS)
    : Object.entries(index).filter(([, position]) => position < 0).map(([key]) => BSE_EXPORT_HEADERS[key as keyof typeof BSE_EXPORT_HEADERS])
  if (missing.length) {
    throw new Error(`Este no parece el Excel de «Consulta de Cotizaciones» de BSE. Faltan las columnas: ${missing.join(", ")}.`)
  }
  const rows: BseRow[] = []
  let skipped = 0
  for (const line of matrix.slice(headerRow + 1)) {
    const cotizacion = normalizeNumber(line[index.cotizacion])
    if (!cotizacion) continue // filas vacías o de totales
    const poliza = normalizeNumber(line[index.poliza])
    const candidate = {
      cotizacion,
      poliza: poliza.length <= 12 ? poliza : "",
      cliente: cellText(line[index.cliente]).slice(0, 200),
      desde: cellText(line[index.desde]).slice(0, 20),
      hasta: cellText(line[index.hasta]).slice(0, 20),
      moneda: cellText(line[index.moneda]).slice(0, 10),
      planPago: cellText(line[index.planPago]).slice(0, 80),
      premioCotizacion: cellNumber(line[index.premioCotizacion]),
      premioPoliza: cellNumber(line[index.premioPoliza]),
    }
    const valid = bseRowSchema.safeParse(candidate)
    if (valid.success) rows.push(valid.data)
    else skipped += 1
  }
  if (!rows.length) throw new Error("El archivo no tiene cotizaciones.")
  return { rows, skipped }
}

/** BSE escribe «$» para pesos y «U$S» para dólares. */
export function isPesos(moneda: string) {
  const value = moneda.trim().toUpperCase()
  return value === "$" || value === "UYU" || value === "" || value === "PESOS"
}

/** «01-11-2026» → «01/11/2026» */
export function formatBseDate(value: string) {
  return /^\d{2}-\d{2}-\d{4}$/.test(value) ? value.replaceAll("-", "/") : value
}

export const PROPOSAL_STATUS_LABEL: Record<ProposalItemStatus, string> = {
  ajustar: "Se ajusta",
  no_alcanza: "Queda la cotización de BSE",
  revisar: "Revisar a mano",
  sin_datos: "Sin datos",
}
