export const CANONICAL_IMPORT_COLUMNS = [
  { key: "company", label: "compañía", required: true },
  { key: "policy_number", label: "número de póliza/certificado", required: false },
  { key: "debtor_document", label: "documento del deudor", required: true },
  { key: "debtor_name", label: "nombre", required: false },
  { key: "phone", label: "teléfono", required: false },
  { key: "email", label: "email", required: false },
  { key: "due_date", label: "vencimiento", required: true },
  { key: "currency", label: "moneda", required: true },
  { key: "amount", label: "importe adeudado", required: true },
  { key: "installment_number", label: "número de cuota", required: false },
  { key: "external_reference", label: "referencia externa", required: false },
] as const

export type CanonicalImportKey = (typeof CANONICAL_IMPORT_COLUMNS)[number]["key"]
export type ImportRawRow = { rowNumber: number; raw: Record<string, string> }
export type ImportIssue = { field?: string; message: string }
export type NormalizedImportRow = ImportRawRow & {
  normalized: Partial<Record<CanonicalImportKey, string | number>>
  errors: ImportIssue[]
  warnings: ImportIssue[]
  dedupeKey: string | null
  duplicate?: boolean
  status: "valid" | "warning" | "error"
}
export type ImportMapping = Partial<Record<CanonicalImportKey, string>>
export const IMPORT_LIMITS = { maxBytes: 10 * 1024 * 1024, maxRows: 10_000 }
const FORMULA_PREFIX = /^[=+\-@\t\r]/

export function canonicalTemplateCsv() {
  return `${CANONICAL_IMPORT_COLUMNS.map((column) => column.label).join(",")}\n` +
    "Ejemplo Seguros,ABC-123,12345678,Ana Pérez,099123456,ana@example.com,2026-09-30,UYU,12500.00,1,REF-001\n"
}

export function canonicalMapping(): ImportMapping {
  return Object.fromEntries(CANONICAL_IMPORT_COLUMNS.map((column) => [column.key, column.label])) as ImportMapping
}

function readZipEntry(bytes: Uint8Array, name: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) !== 0x06054b50) continue
    const directoryOffset = view.getUint32(offset + 16, true)
    const directorySize = view.getUint32(offset + 12, true)
    let cursor = directoryOffset
    const end = directoryOffset + directorySize
    while (cursor < end && view.getUint32(cursor, true) === 0x02014b50) {
      const nameLength = view.getUint16(cursor + 28, true)
      const extraLength = view.getUint16(cursor + 30, true)
      const commentLength = view.getUint16(cursor + 32, true)
      const entryName = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength))
      if (entryName === name) {
        const method = view.getUint16(cursor + 10, true)
        const compressedSize = view.getUint32(cursor + 20, true)
        const localOffset = view.getUint32(cursor + 42, true)
        const localNameLength = view.getUint16(localOffset + 26, true)
        const localExtraLength = view.getUint16(localOffset + 28, true)
        const data = bytes.slice(localOffset + 30 + localNameLength + localExtraLength, localOffset + 30 + localNameLength + localExtraLength + compressedSize)
        return method === 0 ? data : { data, method }
      }
      cursor += 46 + nameLength + extraLength + commentLength
    }
    break
  }
  return null
}

async function unzipEntry(entry: Uint8Array | { data: Uint8Array; method: number }) {
  if (entry instanceof Uint8Array) return entry
  if (entry.method !== 8 || typeof DecompressionStream === "undefined") throw new Error("El XLSX usa una compresión no soportada")
  const stream = new Blob([entry.data as unknown as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function xmlText(value: string) {
  return value.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&apos;", "'")
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const bytes = new Uint8Array(buffer)
  const workbookEntry = readZipEntry(bytes, "xl/workbook.xml")
  const relsEntry = readZipEntry(bytes, "xl/_rels/workbook.xml.rels")
  if (!workbookEntry || !relsEntry || readZipEntry(bytes, "xl/vbaProject.bin")) throw new Error("El XLSX contiene macros o no tiene una estructura segura")
  const workbook = new TextDecoder().decode(await unzipEntry(workbookEntry))
  const rels = new TextDecoder().decode(await unzipEntry(relsEntry))
  const firstSheet = workbook.match(/<sheet\b[^>]*r:id="([^"]+)"[^>]*>/)?.[1]
  const target = firstSheet && rels.match(new RegExp(`<Relationship[^>]*Id="${firstSheet}"[^>]*Target="([^"]+)"`))?.[1]
  if (!target) throw new Error("El XLSX no tiene una hoja legible")
  const sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`
  const sheetEntry = readZipEntry(bytes, sheetPath)
  if (!sheetEntry) throw new Error("No se pudo leer la primera hoja del XLSX")
  const sheet = new TextDecoder().decode(await unzipEntry(sheetEntry))
  if (/<f\b/i.test(sheet) || /<f>/i.test(sheet)) throw new Error("El XLSX contiene fórmulas; exportalo sin fórmulas para continuar")
  const sharedEntry = readZipEntry(bytes, "xl/sharedStrings.xml")
  const shared = sharedEntry ? [...new TextDecoder().decode(await unzipEntry(sharedEntry)).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => xmlText([...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join(""))) : []
  const rows: string[][] = []
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const values: string[] = []
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1]
      const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1] || "A"
      let column = 0
      for (const character of ref) column = column * 26 + character.charCodeAt(0) - 64
      const type = attrs.match(/\bt="([^"]+)"/)?.[1]
      const value = cellMatch[2].match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] || cellMatch[2].match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1] || ""
      values[column - 1] = xmlText(type === "s" ? (shared[Number(value)] || "") : value)
    }
    rows.push(values.map((value) => value || ""))
  }
  return rows
}

export function parseCsv(input: string): string[][] {
  // Excel exporta CSV con BOM: sin quitarlo el primer encabezado no matchea el
  // mapeo y todas las filas salen con error por falta de compañía.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1 } else quoted = !quoted
    } else if (character === "," && !quoted) { row.push(cell); cell = "" }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1
      row.push(cell); cell = ""
      if (row.some((value) => value.trim() !== "")) rows.push(row)
      row = []
    } else cell += character
  }
  if (quoted) throw new Error("El CSV tiene comillas sin cerrar")
  if (cell || row.length) { row.push(cell); if (row.some((value) => value.trim() !== "")) rows.push(row) }
  return rows
}

function clean(value: string | undefined) {
  const trimmed = (value || "").trim()
  return FORMULA_PREFIX.test(trimmed) ? `'${trimmed}` : trimmed
}

function asIsoDate(value: string) {
  const normalized = value.trim().replaceAll("/", "-")
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized
  // Formato local dd-mm-aaaa, que es lo que exporta cualquier planilla de acá.
  const local = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  return local ? `${local[3]}-${local[2]}-${local[1]}` : null
}

/** Acepta 1.234,56 (local), 1,234.56 (inglés) y 1234.56 (crudo). */
function asAmount(value: string) {
  const raw = value.trim().replace(/\s/g, "")
  if (!raw) return NaN
  const lastComma = raw.lastIndexOf(",")
  const lastDot = raw.lastIndexOf(".")
  // El separador decimal es el último que aparece; el otro es de miles.
  const decimal = lastComma > lastDot ? "," : lastDot > lastComma ? "." : ""
  const normalized = decimal === ""
    ? raw
    : raw.slice(0, decimal === "," ? lastComma : lastDot).replace(/[.,]/g, "") + "." + raw.slice((decimal === "," ? lastComma : lastDot) + 1)
  return Number(normalized)
}

export function normalizeRows(rows: string[][], mapping: ImportMapping = canonicalMapping()): NormalizedImportRow[] {
  const headers = rows[0]?.map((header) => header.trim().toLowerCase()) || []
  const indexes = new Map(CANONICAL_IMPORT_COLUMNS.map((column) => [column.key, headers.indexOf((mapping[column.key] || column.label).trim().toLowerCase())]))
  return rows.slice(1, IMPORT_LIMITS.maxRows + 1).map((values, rowIndex) => {
    const raw = Object.fromEntries(CANONICAL_IMPORT_COLUMNS.map((column) => [column.key, clean(indexes.get(column.key) === -1 ? "" : values[indexes.get(column.key) as number])])) as Record<string, string>
    const normalized: Partial<Record<CanonicalImportKey, string | number>> = { ...raw }
    const errors: ImportIssue[] = []
    const warnings: ImportIssue[] = []
    for (const column of CANONICAL_IMPORT_COLUMNS) if (column.required && !raw[column.key]) errors.push({ field: column.key, message: `Falta ${column.label}` })
    if (raw.due_date && !asIsoDate(raw.due_date)) errors.push({ field: "due_date", message: "Usá fecha YYYY-MM-DD" })
    else if (raw.due_date) normalized.due_date = asIsoDate(raw.due_date) as string
    const amount = asAmount(raw.amount)
    if (raw.amount && (!Number.isFinite(amount) || amount < 0)) errors.push({ field: "amount", message: "El importe debe ser numérico y no negativo" })
    else if (raw.amount) normalized.amount = amount
    // La moneda se persiste normalizada: una obligación en 'uyu' después hace
    // fallar todo pago por moneda incompatible contra 'UYU'.
    if (raw.currency && !["UYU", "USD"].includes(raw.currency.toUpperCase())) errors.push({ field: "currency", message: "Moneda permitida: UYU o USD" })
    else if (raw.currency) normalized.currency = raw.currency.toUpperCase()
    if (!raw.external_reference && !raw.policy_number) warnings.push({ field: "policy_number", message: "Sin referencia ni póliza: requiere revisión manual" })
    if (raw.debtor_name && !raw.debtor_document) warnings.push({ field: "debtor_name", message: "El nombre no se usa como coincidencia automática" })
    const identity = raw.external_reference || `${raw.company}|${raw.policy_number}|${raw.debtor_document}|${raw.due_date}|${raw.installment_number}`
    const dedupeKey = identity.replaceAll(/\s+/g, " ").toLowerCase() || null
    return { rowNumber: rowIndex + 2, raw, normalized, errors, warnings, dedupeKey, status: errors.length ? "error" : warnings.length ? "warning" : "valid" }
  })
}

export function markDuplicates(rows: NormalizedImportRow[], previousKeys: Set<string> = new Set()) {
  const seen = new Set(previousKeys)
  return rows.map((row) => {
    if (!row.dedupeKey || !seen.has(row.dedupeKey)) { if (row.dedupeKey) seen.add(row.dedupeKey); return row }
    return { ...row, duplicate: true, warnings: [...row.warnings, { message: "Duplicada en otro lote o dentro del archivo; se omitirá al aplicar" }], status: "warning" as const }
  })
}


