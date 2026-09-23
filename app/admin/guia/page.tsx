import { AlertTriangle, CalendarClock, Cake, FileText, Inbox, Users } from "lucide-react"
import { AdminLayout } from "@/components/admin-layout"
import { PageHeader } from "@/components/brand/page-header"
import { SectionCard } from "@/components/brand/section-card"
import { StatCard } from "@/components/brand/stat-card"
import { EmptyState } from "@/components/brand/empty-state"
import { HelpTip } from "@/components/brand/help-tip"
import { ExpiryBadge, RenewalStatusBadge, StatusBadge } from "@/components/brand/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatMoney } from "@/lib/format"

/**
 * Guía de estilo viva. Todo lo que se ve acá es el componente real, no una
 * imagen: si algo cambia en el código, cambia acá. Referencia escrita en
 * docs/GUIA_DE_ESTILO.md.
 */

const colors = [
  { token: "background", label: "Marfil", note: "Fondo de la app" },
  { token: "card", label: "Papel", note: "Tarjetas y paneles" },
  { token: "foreground", label: "Tinta", note: "Texto principal" },
  { token: "muted-foreground", label: "Tinta suave", note: "Texto secundario" },
  { token: "primary", label: "Petróleo", note: "Acción principal" },
  { token: "sidebar", label: "Petróleo profundo", note: "Menú lateral" },
  { token: "gold", label: "Latón", note: "Solo detalles" },
  { token: "border", label: "Filete", note: "Bordes" },
]

const states = [
  { soft: "success-soft", strong: "success-strong", label: "Bien / vigente" },
  { soft: "warning-soft", strong: "warning-strong", label: "Atención / por vencer" },
  { soft: "danger-soft", strong: "danger-strong", label: "Urgente / vencida" },
  { soft: "info-soft", strong: "info-strong", label: "Información" },
]

const typeScale = [
  { className: "font-display text-5xl", sample: "Buen día, Mercedes", note: "Display 48 · saludo de Inicio" },
  { className: "font-display text-4xl", sample: "Pólizas por vencer", note: "Display 40 · título de página" },
  { className: "font-display text-2xl", sample: "La cartera en números", note: "Display 26 · sección" },
  { className: "font-display text-xl", sample: "Vencen esta semana", note: "Display 22 · título de tarjeta" },
  { className: "text-lg font-semibold", sample: "Corrales Ledesma Loreley", note: "Sans 19 · nombre en una lista" },
  { className: "text-base", sample: "Avisale al cliente y anotá en qué quedó.", note: "Sans 17 · texto de cuerpo" },
  { className: "text-sm text-muted-foreground", sample: "Póliza 2221141 · Auto · SURA", note: "Sans 15 · dato secundario" },
  {
    className: "text-xs font-semibold uppercase tracking-[0.14em] text-gold-foreground",
    sample: "Renovaciones",
    note: "Sans 14 · antetítulo (el mínimo)",
  },
]

const principles = [
  ["Que se entienda sola", "Cada pantalla dice qué es y cuál es la acción principal. Si hace falta explicarla, falta ayuda en la pantalla."],
  ["Letra grande, contraste alto", "Nada por debajo de 14px. El cuerpo es de 17px. Contraste AA como mínimo."],
  ["Palabras, no códigos", "«Vence en 3 días», no «3d». «Guardar cliente», no «Submit». Vos, nunca tú."],
  ["Lujo es calma", "Mucho aire, pocos colores, una serif para títulos. El latón solo como detalle."],
]

export default function StyleGuidePage() {
  return (
    <AdminLayout>
      <div className="space-y-10">
        <PageHeader
          eyebrow="Diseño"
          title="Guía de estilo"
          description="Los colores, letras y piezas con las que está hecho el sistema. Todo lo nuevo se arma con esto."
        />

        <SectionCard title="Principios" description="Si hay que elegir, gana el primero.">
          <ol className="grid gap-4 text-base sm:grid-cols-2">
            {principles.map(([title, text], index) => (
              <li key={title} className="flex gap-4 rounded-xl bg-muted/50 p-4">
                <span className="font-display text-3xl text-gold">{index + 1}</span>
                <span>
                  <strong className="block font-semibold">{title}</strong>
                  <span className="text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </SectionCard>

        <SectionCard title="Color" description="Tokens en app/globals.css. Nunca poner un color a mano en un componente.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {colors.map((color) => (
              <div key={color.token} className="overflow-hidden rounded-xl border">
                <div className="h-20 border-b" style={{ background: `var(--${color.token})` }} />
                <div className="space-y-0.5 p-3">
                  <p className="font-semibold">{color.label}</p>
                  <p className="font-mono text-sm text-muted-foreground">--{color.token}</p>
                  <p className="text-sm text-muted-foreground">{color.note}</p>
                </div>
              </div>
            ))}
          </div>
          <h3 className="mb-3 mt-8 font-semibold">Estados — siempre con ícono y palabra</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {states.map((state) => (
              <div
                key={state.label}
                className="rounded-xl p-4 font-semibold"
                style={{ background: `var(--${state.soft})`, color: `var(--${state.strong})` }}
              >
                {state.label}
              </div>
            ))}
          </div>
          <h3 className="mb-3 mt-8 font-semibold">Gráficos</h3>
          <div className="flex overflow-hidden rounded-xl border">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-12 flex-1" style={{ background: `var(--chart-${n})` }} title={`--chart-${n}`} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Tipografía" description="Fraunces para títulos y cifras. Figtree para todo lo demás.">
          <div className="divide-y">
            {typeScale.map((row) => (
              <div
                key={row.note}
                className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <span className={row.className}>{row.sample}</span>
                <span className="shrink-0 text-sm text-muted-foreground">{row.note}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Botones" description="Una sola acción principal (petróleo) por pantalla. Alto mínimo 44px.">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Guardar cliente</Button>
            <Button variant="outline">Cancelar</Button>
            <Button variant="ghost">Ver todos</Button>
            <Button variant="destructive">Sí, eliminar</Button>
            <Button size="sm" variant="outline">
              Chico
            </Button>
            <Button size="lg">Grande</Button>
          </div>
        </SectionCard>

        <SectionCard title="Estados de una póliza">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <ExpiryBadge days={-2} />
              <ExpiryBadge days={0} />
              <ExpiryBadge days={5} />
              <ExpiryBadge days={20} />
              <ExpiryBadge days={120} />
            </div>
            <div className="flex flex-wrap gap-2">
              {["Pendiente", "Contactado", "En Proceso", "Renovada", "No Renovada"].map((status) => (
                <RenewalStatusBadge key={status} status={status} />
              ))}
            </div>
            <StatusBadge tone="warning" icon={AlertTriangle}>
              Falta el teléfono
            </StatusBadge>
          </div>
        </SectionCard>

        <SectionCard title="Formularios" description="Etiqueta arriba, ayuda debajo, el error en palabras.">
          <div className="grid max-w-xl gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="demo-poliza">Número de póliza</Label>
                <HelpTip>Está arriba a la derecha, en la primera hoja de la póliza.</HelpTip>
              </div>
              <Input id="demo-poliza" placeholder="Ej: 2221141" />
              <p className="text-sm text-muted-foreground">Tal cual figura en el documento de la aseguradora.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-tel">Teléfono</Label>
              <Input id="demo-tel" aria-invalid defaultValue="09" />
              <p className="text-sm font-medium text-danger-strong">
                Faltan números. Un celular tiene 9 dígitos, ej: 099 123 456.
              </p>
            </div>
          </div>
        </SectionCard>

        <div className="space-y-4">
          <h2 className="font-display text-2xl">Cifras y estados vacíos</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Clientes" value="849" hint="Ver la lista" icon={Users} href="/admin/clientes" />
            <StatCard label="Vigentes" value="1.427" hint="Todas las pólizas" icon={FileText} tone="success" />
            <StatCard label="Vencen en 30 días" value="73" hint="Por vencer" icon={CalendarClock} tone="warning" />
            <StatCard label="Prima del mes" value={formatMoney(1250000)} hint="En pesos" icon={Cake} />
          </div>
          <EmptyState
            icon={Inbox}
            title="Todavía no hay siniestros"
            description="Cuando un cliente te avise de un choque o un robo, registralo acá para seguirlo hasta que la aseguradora pague."
            action={<Button>Registrar el primero</Button>}
          />
        </div>
      </div>
    </AdminLayout>
  )
}
