import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface SectionCardProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

/** Bloque de contenido con título en serif. Base de las secciones de Inicio. */
export function SectionCard({ title, description, action, children, className, bodyClassName }: SectionCardProps) {
  return (
    <section className={cn("rounded-2xl border bg-card shadow-sm", className)}>
      <div className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
        <div className="min-w-0 space-y-1">
          <h2 className="font-display text-xl">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn("px-5 py-4 sm:px-6", bodyClassName)}>{children}</div>
    </section>
  )
}
