"use client"

import { useEffect, useState } from "react"
import { useShellUser } from "@/components/shell/user-context"
import { firstName, greeting } from "@/lib/format"

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

/** Saludo con el nombre y la fecha de hoy. Se calcula en el navegador: la hora es la de ella. */
export function GreetingHeader({ pendingCount }: { pendingCount: number }) {
  const user = useShellUser()
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => setNow(new Date()), [])

  const name = firstName(user?.displayName)
  const dateLabel = now ? `Hoy es ${WEEKDAYS[now.getDay()]} ${now.getDate()} de ${MONTHS[now.getMonth()]}` : " "

  return (
    <header data-tour="page-header" className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-foreground">{dateLabel}</p>
      <h1 className="font-display text-4xl text-foreground sm:text-5xl">
        {now ? greeting(now) : "Hola"}
        {name ? `, ${name}` : ""}
      </h1>
      <p className="max-w-2xl text-lg text-muted-foreground">
        {pendingCount === 0
          ? "Todo al día. No hay nada urgente para hoy."
          : pendingCount === 1
            ? "Hay 1 cosa para atender hoy. Está acá abajo."
            : `Hay ${pendingCount} cosas para atender hoy. Están acá abajo.`}
      </p>
    </header>
  )
}
