/** @jsxRuntime classic */
/** @jsx h */
import path from "node:path"
import * as ReactPdf from "@react-pdf/renderer"
import { formatBseDate, itemsForClient, proposalTotals, type ProposalItem } from "@/lib/renewal-proposals"

// Tokens de marca (docs/GUIA_DE_ESTILO.md). Nada de colores sueltos.
const brand = {
  background: "#f6f3ec", // marfil
  card: "#fffdf8", // papel
  ink: "#1b2526", // tinta
  muted: "#56615f",
  primary: "#1f5257", // petróleo
  sidebar: "#102a2c",
  gold: "#a8844a",
  goldInk: "#7a5d2c",
  border: "#e0d9c9",
}

const ASSETS = path.join(process.cwd(), "assets", "pdf")

/**
 * OJO: las rutas del App Router compilan el JSX con el React 19 que trae Next
 * adentro, pero @react-pdf/renderer (externo, ver serverExternalPackages) usa el
 * React 18 instalado y no reconoce esos elementos (error #31). Por eso este
 * archivo usa el pragma `@jsx h`: los elementos se crean con el React que resuelve
 * react-pdf desde su propia carpeta en node_modules.
 */
type ReactPdfModule = typeof import("@react-pdf/renderer")
type ReactModule = typeof import("react")
// require nativo de Node: webpack no lo reescribe (sí reescribe createRequire importado).
// Este archivo solo corre dentro de Next (webpack), donde siempre existe.
declare const __non_webpack_require__: NodeRequire
let runtime: { pdf: ReactPdfModule; React: ReactModule } | null = null
function loadRuntime() {
  if (runtime) return runtime
  const { createRequire } = __non_webpack_require__("node:module") as typeof import("node:module")
  const fromPdf = createRequire(path.join(process.cwd(), "node_modules", "@react-pdf", "renderer", "package.json"))
  runtime = { pdf: ReactPdf as ReactPdfModule, React: fromPdf("react") as ReactModule }
  return runtime
}

/** createElement del React de react-pdf (ver pragma @jsx arriba). */
function h(type: any, props: any, ...children: any[]) {
  return loadRuntime().React.createElement(type, props, ...children)
}
let fontsReady = false
function registerFonts() {
  if (fontsReady) return
  const { Font } = loadRuntime().pdf
  Font.register({ family: "Fraunces", src: path.join(ASSETS, "fraunces-latin-600-normal.woff"), fontWeight: 600 })
  Font.register({
    family: "Figtree",
    fonts: [
      { src: path.join(ASSETS, "figtree-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(ASSETS, "figtree-latin-600-normal.woff"), fontWeight: 600 },
      { src: path.join(ASSETS, "figtree-latin-700-normal.woff"), fontWeight: 700 },
    ],
  })
  // Sin cortes de palabra con guiones en nombres de clientes ni montos.
  Font.registerHyphenationCallback((word) => [word])
  fontsReady = true
}

const money = (value: number | null) =>
  value === null ? "—" : "$ " + Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
const percent = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")} %`

const styleSheet = {
  page: { backgroundColor: brand.card, fontFamily: "Figtree", fontSize: 10, color: brand.ink, paddingBottom: 56 },
  band: { backgroundColor: brand.sidebar, paddingVertical: 18, paddingHorizontal: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { width: 132, height: 48, objectFit: "contain" },
  bandRight: { alignItems: "flex-end" },
  eyebrowLight: { color: brand.gold, fontSize: 8, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase" },
  bandDate: { color: "#e8e2d4", fontSize: 9, marginTop: 4 },
  goldRule: { height: 2, backgroundColor: brand.gold },
  body: { paddingHorizontal: 40, paddingTop: 26 },
  eyebrow: { color: brand.goldInk, fontSize: 8, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 6 },
  title: { fontFamily: "Fraunces", fontWeight: 600, fontSize: 24, color: brand.ink, marginBottom: 4 },
  lead: { fontSize: 10.5, color: brand.muted, lineHeight: 1.45, marginBottom: 18, maxWidth: 440 },
  meta: { flexDirection: "row", backgroundColor: brand.background, borderRadius: 8, borderWidth: 1, borderColor: brand.border, padding: 12, marginBottom: 14 },
  metaCell: { flex: 1, paddingRight: 10 },
  metaLabel: { fontSize: 7.5, color: brand.muted, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 },
  metaValue: { fontSize: 10, fontWeight: 600, color: brand.ink },
  table: { borderWidth: 1, borderColor: brand.border, borderRadius: 8, overflow: "hidden" },
  headRow: { flexDirection: "row", backgroundColor: brand.primary },
  headCell: { color: "#ffffff", fontSize: 8, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", paddingVertical: 8, paddingHorizontal: 8 },
  row: { flexDirection: "row", borderTopWidth: 1, borderTopColor: brand.border },
  rowAlt: { backgroundColor: "#faf7f0" },
  cell: { fontSize: 9.5, paddingVertical: 7, paddingHorizontal: 8 },
  right: { textAlign: "right" },
  strong: { fontWeight: 700 },
  totalRow: { flexDirection: "row", borderTopWidth: 1.5, borderTopColor: brand.primary, backgroundColor: brand.background },
  summary: { flexDirection: "row", marginBottom: 18 },
  summaryBox: { flex: 1, borderWidth: 1, borderColor: brand.border, borderRadius: 8, padding: 12, marginRight: 10 },
  summaryBoxLast: { flex: 1, borderWidth: 1, borderColor: brand.primary, borderRadius: 8, padding: 12, backgroundColor: "#eef4f3" },
  summaryNumber: { fontFamily: "Fraunces", fontWeight: 600, fontSize: 18, color: brand.ink, marginTop: 4 },
  note: { fontSize: 8.5, color: brand.muted, lineHeight: 1.5, marginTop: 18 },
  footer: { position: "absolute", left: 40, right: 40, bottom: 22, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: brand.border, paddingTop: 8 },
  footerText: { fontSize: 8, color: brand.muted },
} as const
const styles = styleSheet as any

const columns = [
  { key: "poliza", label: "Póliza", width: "15%" },
  { key: "tipo", label: "Seguro", width: "21%" },
  { key: "plan", label: "Forma de pago", width: "20%" },
  { key: "actual", label: "Premio actual", width: "15%", right: true },
  { key: "nuevo", label: "Premio renovación", width: "17%", right: true },
  { key: "var", label: "Variación", width: "12%", right: true },
] as const

export type ProposalPdfInput = {
  clientName: string
  clientDocument: string | null
  generatedAt: Date
  items: (ProposalItem & { tipo?: string | null })[]
}

function ProposalDocument({ clientName, clientDocument, generatedAt, items }: ProposalPdfInput) {
  const { Document, Page, View, Text, Image } = loadRuntime().pdf
  const shown = (itemsForClient(items) as ProposalPdfInput["items"]).sort((a, b) => a.numero_poliza.localeCompare(b.numero_poliza))
  const totals = proposalTotals(items)
  const desde = [...new Set(shown.map((item) => formatBseDate(item.desde)))]
  const hasta = [...new Set(shown.map((item) => formatBseDate(item.hasta)))]
  const vigencia = desde.length === 1 && hasta.length === 1 ? `${desde[0]} al ${hasta[0]}` : "Según cada póliza"
  const fecha = generatedAt.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Montevideo" })

  return (
    <Document title={`Propuesta de renovación — ${clientName}`} author="Isgleas Seguros" creator="Isgleas Seguros" language="es-UY">
      <Page size="A4" style={styles.page}>
        <View style={styles.band} fixed>
          <Image src={path.join(ASSETS, "logo-isgleas.png")} style={styles.logo} />
          <View style={styles.bandRight}>
            <Text style={styles.eyebrowLight}>Propuesta de renovación</Text>
            <Text style={styles.bandDate}>{fecha}</Text>
          </View>
        </View>
        <View style={styles.goldRule} fixed />

        <View style={styles.body}>
          <Text style={styles.eyebrow}>Banco de Seguros del Estado</Text>
          <Text style={styles.title}>{clientName}</Text>
          <Text style={styles.lead}>
            Te compartimos la propuesta de renovación de tus seguros para el próximo período. Abajo vas a ver, póliza por póliza,
            lo que pagás hoy y lo que pagarías al renovar.
          </Text>

          <View style={styles.meta}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Cliente</Text>
              <Text style={styles.metaValue}>{clientName}</Text>
            </View>
            {clientDocument ? (
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>Documento</Text>
                <Text style={styles.metaValue}>{clientDocument}</Text>
              </View>
            ) : null}
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Vigencia</Text>
              <Text style={styles.metaValue}>{vigencia}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Pólizas</Text>
              <Text style={styles.metaValue}>{shown.length}</Text>
            </View>
          </View>

          <View style={styles.summary} wrap={false}>
            <View style={styles.summaryBox}>
              <Text style={styles.metaLabel}>Pagás hoy</Text>
              <Text style={styles.summaryNumber}>{money(totals.actual)}</Text>
            </View>
            <View style={styles.summaryBoxLast}>
              <Text style={styles.metaLabel}>Renovación propuesta</Text>
              <Text style={styles.summaryNumber}>{money(totals.propuesto)}</Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.headRow} fixed>
              {columns.map((column) => (
                <Text key={column.key} style={[styles.headCell, { width: column.width }, "right" in column && column.right ? styles.right : {}]}>
                  {column.label}
                </Text>
              ))}
            </View>
            {shown.map((item, index) => (
              <View key={`${item.numero_cotizacion}-${index}`} style={[styles.row, index % 2 === 1 ? styles.rowAlt : {}]} wrap={false}>
                <Text style={[styles.cell, { width: columns[0].width }]}>{item.numero_poliza}</Text>
                <Text style={[styles.cell, { width: columns[1].width }]}>{item.tipo || "—"}</Text>
                <Text style={[styles.cell, { width: columns[2].width }]}>{item.plan_pago.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</Text>
                <Text style={[styles.cell, styles.right, { width: columns[3].width }]}>{money(item.premio_poliza)}</Text>
                <Text style={[styles.cell, styles.right, styles.strong, { width: columns[4].width }]}>{money(item.premio_propuesto)}</Text>
                <Text style={[styles.cell, styles.right, { width: columns[5].width }]}>{percent(item.variacion_pct)}</Text>
              </View>
            ))}
            <View style={styles.totalRow} wrap={false}>
              <Text style={[styles.cell, styles.strong, { width: "56%" }]}>Total</Text>
              <Text style={[styles.cell, styles.right, styles.strong, { width: columns[3].width }]}>{money(totals.actual)}</Text>
              <Text style={[styles.cell, styles.right, styles.strong, { width: columns[4].width }]}>{money(totals.propuesto)}</Text>
              <Text style={[styles.cell, styles.right, styles.strong, { width: columns[5].width }]}>{percent(totals.variacion_pct)}</Text>
            </View>
          </View>

          <Text style={styles.note}>
            Importes en pesos uruguayos con impuestos incluidos, por el total del período. El importe final puede variar en algunos
            pesos por redondeo de cuotas y queda sujeto a la emisión de cada póliza por el Banco de Seguros del Estado y a sus
            condiciones generales y particulares. Si querés cambiar algo, respondenos este mensaje.
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Isgleas Seguros · Corredores de seguros</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export async function renderProposalPdf(input: ProposalPdfInput): Promise<Buffer> {
  registerFonts()
  return loadRuntime().pdf.renderToBuffer(<ProposalDocument {...input} />)
}
