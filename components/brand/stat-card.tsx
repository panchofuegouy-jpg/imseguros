import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

type Tone = "neutral" | "warning" | "danger" | "success"

const toneStyles: Record<Tone, string> = {
  neutral: "bg-accent text-accent-foreground",
  warning: "bg-warning-soft text-warning-strong",
  danger: "bg-danger-soft text-danger-strong",
  success: "bg-success-soft text-success-strong",
}

interface StatCardProps {
  label: string
  value: string | number
  /** Frase que explica la cifra en palabras. */
  hint?: string
  icon: LucideIcon
  href?: string
  tone?: Tone
  className?: string
}

/** Una cifra grande con su explicación. Si tiene href, toda la tarjeta es un enlace. */
export function StatCard({ label, value, hint, icon: Icon, href, tone = "neutral", className }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-base font-semibold text-muted-foreground">{label}</span>
        <span className={cn("grid size-10 place-items-center rounded-full", toneStyles[tone])}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      <div className="font-display text-4xl tabular-nums text-foreground">{value}</div>
      {hint && (
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          {hint}
          {href && (
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          )}
        </p>
      )}
    </>
  )

  const base = cn(
    "group flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-[border-color,box-shadow] duration-200",
    href && "hover:border-primary/30 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none",
    className,
  )

  return href ? (
    <Link href={href} className={base}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  )
}
