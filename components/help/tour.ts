"use client"

import { driver } from "driver.js"
import "driver.js/dist/driver.css"
import { TOURS } from "@/lib/help/content"

const SEEN_PREFIX = "isgleas:tour-visto:"

export function hasSeenTour(id: string) {
  try {
    return window.localStorage.getItem(SEEN_PREFIX + id) === "1"
  } catch {
    return true // sin storage no molestamos con el tour automático
  }
}

function markTourSeen(id: string) {
  try {
    window.localStorage.setItem(SEEN_PREFIX + id, "1")
  } catch {
    // sin storage: el tour vuelve a ofrecerse, no es grave
  }
}

/** El primer elemento visible que coincide: en celular y escritorio hay versiones distintas. */
function findVisible(selector?: string): Element | undefined {
  if (!selector) return undefined
  return Array.from(document.querySelectorAll(selector)).find((element) => element.getClientRects().length > 0)
}

/** Lanza un recorrido guiado. Los pasos cuyo elemento no existe se muestran centrados. */
export function startTour(id: string) {
  const tour = TOURS[id]
  if (!tour) return

  const tourDriver = driver({
    showProgress: tour.steps.length > 1,
    progressText: "Paso {{current}} de {{total}}",
    nextBtnText: "Siguiente",
    prevBtnText: "Atrás",
    doneBtnText: "Listo",
    popoverClass: "isgleas-tour",
    stagePadding: 6,
    stageRadius: 12,
    overlayOpacity: 0.55,
    // Un clic afuera sin querer no debería cerrar el recorrido: se sale con la cruz o «Listo».
    overlayClickBehavior: () => {},
    // Durante el recorrido se mira, no se toca: evita abrir cosas por accidente.
    disableActiveInteraction: true,
    smoothScroll: true,
    onDestroyed: () => markTourSeen(id),
    steps: tour.steps.map((step) => ({
      element: findVisible(step.element),
      popover: { title: step.title, description: step.description },
    })),
  })

  tourDriver.drive()
}
