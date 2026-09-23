import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  /** Qué va a aparecer acá y cómo llegar a eso. */
  description?: ReactNode
  action?: ReactNode
  className?: string
}

/** Un estado vacío que enseña: dice qué falta y ofrece el botón para hacerlo. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card/60 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-7" aria-hidden />
      </span>
      <h3 className="font-display text-xl">{title}</h3>
      {description && <p className="max-w-md text-base text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
