/**
 * Formatos de Uruguay para toda la interfaz. Nunca mostrar fechas ISO ni
 * montos sin separador de miles.
 */

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

/** Interpreta "AAAA-MM-DD" como fecha local (sin corrimiento por zona horaria). */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** 15/10/2026 */
export function formatDate(value: string | null | undefined) {
  const date = parseDateOnly(value)
  if (!date) return "—"
  return date.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" })
}

/** 15 de octubre (agrega el año solo si no es el actual) */
export function formatDateLong(value: string | null | undefined) {
  const date = parseDateOnly(value)
  if (!date) return "—"
  const base = `${date.getDate()} de ${MONTHS[date.getMonth()]}`
  return date.getFullYear() === new Date().getFullYear() ? base : `${base} de ${date.getFullYear()}`
}

/** Días enteros desde hoy hasta la fecha (negativo si ya pasó). */
export function daysUntil(value: string | null | undefined) {
  const date = parseDateOnly(value)
  if (!date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((date.getTime() - today.getTime()) / 86_400_000)
}

/** "hoy", "mañana", "en 5 días", "hace 3 días" */
export function relativeDays(days: number | null) {
  if (days === null) return ""
  if (days === 0) return "hoy"
  if (days === 1) return "mañana"
  if (days === -1) return "ayer"
  return days > 0 ? `en ${days} días` : `hace ${-days} días`
}

/** $ 12.500 · U$S 1.200 */
export function formatMoney(amount: number | null | undefined, currency: string = "UYU") {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return "—"
  const symbol = currency === "USD" ? "U$S" : "$"
  const number = Number(amount).toLocaleString("es-UY", { maximumFractionDigits: 0 })
  return `${symbol} ${number}`
}

export function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("es-UY")
}

/** "Buen día" / "Buenas tardes" / "Buenas noches" según la hora de Montevideo. */
export function greeting(now = new Date()) {
  const hour = Number(
    now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Montevideo" }),
  )
  if (hour < 12) return "Buen día"
  if (hour < 20) return "Buenas tardes"
  return "Buenas noches"
}

export function firstName(fullName: string | null | undefined) {
  if (!fullName) return ""
  const first = fullName.trim().split(/\s+/)[0] ?? ""
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
}
