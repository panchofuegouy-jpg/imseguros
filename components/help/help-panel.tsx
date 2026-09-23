"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { CirclePlay, HelpCircle, LifeBuoy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { helpForPath } from "@/lib/help/content"
import { startTour } from "@/components/help/tour"

/** Botón «Ayuda» de la barra superior + panel lateral con la ayuda de la pantalla actual. */
export function HelpPanel() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const section = helpForPath(pathname)

  const showMe = (tourId: string) => {
    setOpen(false)
    // Esperar a que el panel se cierre para que el recorrido resalte la pantalla real.
    setTimeout(() => startTour(tourId), 320)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        data-tour="help"
        onClick={() => setOpen(true)}
        className="rounded-full"
      >
        <HelpCircle aria-hidden />
        <span className="hidden sm:inline">Ayuda</span>
        <span className="sr-only sm:hidden">Ayuda</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="gap-2 border-b bg-accent/40 px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold-foreground">Ayuda</p>
            <SheetTitle className="text-3xl">{section.title}</SheetTitle>
            <SheetDescription className="text-base leading-relaxed">{section.intro}</SheetDescription>
          </SheetHeader>

          <div className="px-6 py-4">
            <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Preguntas frecuentes
            </h3>
            <Accordion type="single" collapsible className="w-full">
              {section.questions.map((item) => (
                <AccordionItem key={item.question} value={item.question}>
                  <AccordionTrigger className="py-4 text-left text-base font-semibold hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 text-base leading-relaxed text-muted-foreground">
                    <p>{item.answer}</p>
                    {item.tourId && (
                      <Button onClick={() => showMe(item.tourId!)} className="w-full sm:w-auto">
                        <CirclePlay aria-hidden />
                        Mostrarme cómo
                      </Button>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <div className="mx-6 mb-6 mt-2 space-y-3 rounded-2xl border bg-muted/40 p-5">
            <div className="flex items-center gap-2 font-semibold">
              <LifeBuoy className="size-5 text-primary" aria-hidden />
              ¿Primera vez?
            </div>
            <p className="text-base text-muted-foreground">
              Te muestro en un minuto dónde está cada cosa del sistema.
            </p>
            <Button variant="outline" onClick={() => showMe("bienvenida")} className="w-full">
              <CirclePlay aria-hidden />
              Ver el recorrido de bienvenida
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
