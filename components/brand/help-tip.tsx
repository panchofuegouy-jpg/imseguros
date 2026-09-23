"use client"

import { HelpCircle } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/**
 * Un "?" al lado de un campo o título que explica qué es, en palabras simples.
 * Es un popover (se abre con clic o toque) y no un tooltip: en celular y con
 * poca práctica con el mouse, el hover no existe.
 */
export function HelpTip({ children, label = "¿Qué es esto?" }: { children: React.ReactNode; label?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        type="button"
        aria-label={label}
        className="inline-grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none"
      >
        <HelpCircle className="size-5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent className="max-w-xs text-base leading-relaxed">{children}</PopoverContent>
    </Popover>
  )
}
