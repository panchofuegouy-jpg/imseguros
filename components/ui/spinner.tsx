import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const sizes = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
} as const

export function Spinner({
  className,
  size = "md",
  ...props
}: React.ComponentProps<"svg"> & { size?: keyof typeof sizes }) {
  return (
    <Loader2
      role="status"
      aria-label="Cargando"
      className={cn("animate-spin text-primary", sizes[size], className)}
      {...props}
    />
  )
}

/**
 * Pantalla de carga a página completa. Aparece con 150ms de retraso: si la carga
 * es rápida el usuario no ve un spinner parpadear, y si tarda entra suave.
 */
export function LoadingScreen({
  label,
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-[60vh] flex-col items-center justify-center gap-3",
        "animate-in fade-in-0 duration-300 ease-soft delay-150 fill-mode-both",
        className
      )}
    >
      <Spinner size="lg" />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  )
}
