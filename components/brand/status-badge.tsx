import type { LucideIcon } from "lucide-react"
import { AlertTriangle, CheckCircle2, Clock, Phone, RefreshCw, XCircle, CircleDot } from "lucide-react"
import { cn } from "@/lib/utils"

export type StatusTone = "neutral" | "info" | "warning" | "danger" | "success"

const toneStyles: Record<StatusTone, string> = {
  neutral: "border-border bg-muted text-foreground",
  info: "border-info-strong/20 bg-info-soft text-info-strong",
  warning: "border-gold/40 bg-warning-soft text-warning-strong",
  danger: "border-destructive/25 bg-danger-soft text-danger-strong",
  success: "border-success-strong/25 bg-success-soft text-success-strong",
}

interface StatusBadgeProps {
  tone: StatusTone
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
}

/** Estado con ícono + palabra. Nunca comunicar un estado solo con color. */
export function StatusBadge({ tone, icon: Icon = CircleDot, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-sm font-semibold",
        toneStyles[tone],
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </span>
  )
}

/** Estado de gestión de una renovación (columna `status` de policies). */
export const RENEWAL_STATUS: Record<string, { tone: StatusTone; icon: LucideIcon; label: string }> = {
  Pendiente: { tone: "neutral", icon: Clock, label: "Pendiente" },
  Contactado: { tone: "info", icon: Phone, label: "Contactado" },
  "En Proceso": { tone: "warning", icon: RefreshCw, label: "En proceso" },
  Renovada: { tone: "success", icon: CheckCircle2, label: "Renovada" },
  "No Renovada": { tone: "danger", icon: XCircle, label: "No renovada" },
}

export function RenewalStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const config = RENEWAL_STATUS[status ?? "Pendiente"] ?? RENEWAL_STATUS.Pendiente
  return (
    <StatusBadge tone={config.tone} icon={config.icon} className={className}>
      {config.label}
    </StatusBadge>
  )
}

/** Vigencia de una póliza según los días que faltan para su vencimiento. */
export function ExpiryBadge({ days, className }: { days: number | null; className?: string }) {
  if (days === null) return null
  if (days < 0)
    return (
      <StatusBadge tone="danger" icon={XCircle} className={className}>
        Vencida
      </StatusBadge>
    )
  if (days <= 7)
    return (
      <StatusBadge tone="danger" icon={AlertTriangle} className={className}>
        {days === 0 ? "Vence hoy" : days === 1 ? "Vence mañana" : `Vence en ${days} días`}
      </StatusBadge>
    )
  if (days <= 30)
    return (
      <StatusBadge tone="warning" icon={Clock} className={className}>
        Vence en {days} días
      </StatusBadge>
    )
  return (
    <StatusBadge tone="success" icon={CheckCircle2} className={className}>
      Vigente
    </StatusBadge>
  )
}
