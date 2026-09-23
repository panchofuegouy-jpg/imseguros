import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  /** Palabra corta sobre el título, en latón (ej. "Operaciones"). */
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  /** Botones a la derecha. La acción principal va última. */
  actions?: ReactNode
  className?: string
}

/** Encabezado de cada pantalla: un título grande, una frase y la acción principal. */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      data-tour="page-header"
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-foreground">{eyebrow}</p>
        )}
        <h1 className="font-display text-3xl text-foreground sm:text-4xl">{title}</h1>
        {description && <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </header>
  )
}
