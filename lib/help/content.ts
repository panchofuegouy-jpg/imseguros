/**
 * Ayuda integrada: preguntas frecuentes y recorridos guiados por pantalla.
 *
 * Los recorridos apuntan a elementos con `data-tour="..."`. Si un elemento no
 * está en pantalla (por ejemplo en celular), el paso se muestra centrado igual,
 * así que nunca se rompe: solo pierde el resaltado.
 *
 * Tono: frases cortas, "vos", verbos concretos. Como si se lo explicaras en
 * persona a alguien que nunca usó el sistema.
 */

export interface TourStep {
  /** Selector del elemento a resaltar. Sin selector, el paso va centrado. */
  element?: string
  title: string
  description: string
}

export interface Tour {
  id: string
  title: string
  steps: TourStep[]
}

export interface HelpQuestion {
  question: string
  answer: string
  /** Recorrido que muestra en pantalla cómo hacerlo. */
  tourId?: string
}

export interface HelpSection {
  /** Prefijo de ruta al que aplica. El más largo que coincida gana. */
  path: string
  title: string
  intro: string
  questions: HelpQuestion[]
}

const nav = (href: string) => `[data-tour="nav"] a[href="${href}"]`

export const TOURS: Record<string, Tour> = {
  bienvenida: {
    id: "bienvenida",
    title: "Recorrido de bienvenida",
    steps: [
      {
        title: "¡Bienvenida a Isgleas Seguros!",
        description:
          "Te muestro en un minuto dónde está cada cosa. Podés avanzar con «Siguiente» o salir cuando quieras con la cruz.",
      },
      {
        element: '[data-tour="nav"]',
        title: "El menú",
        description:
          "Desde acá vas a cada parte del sistema: clientes, pólizas, vencimientos, cobranza y más. La sección en la que estás queda marcada.",
      },
      {
        element: nav("/admin"),
        title: "Inicio",
        description:
          "Es la primera pantalla. Te muestra lo que tenés que hacer hoy: pólizas que vencen, cumpleaños y cobros atrasados.",
      },
      {
        element: '[data-tour="search"]',
        title: "Buscar un cliente",
        description:
          "La forma más rápida de encontrar a alguien. Escribí su nombre, cédula o número de póliza y tocá el resultado.",
      },
      {
        element: '[data-tour="new"]',
        title: "Agregar algo nuevo",
        description: "Con este botón cargás un cliente nuevo desde cualquier pantalla.",
      },
      {
        element: nav("/admin/polizas/por-vencer"),
        title: "Pólizas por vencer",
        description:
          "Acá están las pólizas que hay que renovar pronto. Podés escribirle al cliente por WhatsApp y marcar en qué quedó.",
      },
      {
        element: '[data-tour="help"]',
        title: "Si tenés una duda",
        description:
          "Tocá «Ayuda» en cualquier momento. Te explica la pantalla en la que estás y te muestra cómo hacer cada cosa, paso a paso.",
      },
    ],
  },

  "buscar-cliente": {
    id: "buscar-cliente",
    title: "Cómo encontrar un cliente",
    steps: [
      {
        element: '[data-tour="search"]',
        title: "1. Tocá el buscador",
        description: "Está siempre arriba, en todas las pantallas. También podés apretar Ctrl + K.",
      },
      {
        title: "2. Escribí lo que sepas",
        description:
          "Nombre, apellido, cédula o número de póliza. Con las primeras letras alcanza. Después tocá el cliente en la lista.",
      },
    ],
  },

  "nuevo-cliente": {
    id: "nuevo-cliente",
    title: "Cómo agregar un cliente",
    steps: [
      {
        element: '[data-tour="new"]',
        title: "1. Tocá «Nuevo cliente»",
        description: "Se abre un formulario.",
      },
      {
        title: "2. Completá los datos",
        description:
          "Lo único obligatorio es el nombre. El teléfono es muy útil: con él vas a poder escribirle por WhatsApp desde el sistema.",
      },
      {
        title: "3. Guardá",
        description:
          "Tocá «Guardar» abajo. El cliente aparece en la lista y ya le podés cargar pólizas desde su ficha.",
      },
    ],
  },

  "cargar-poliza": {
    id: "cargar-poliza",
    title: "Cómo cargar una póliza",
    steps: [
      {
        element: '[data-tour="search"]',
        title: "1. Buscá al cliente",
        description: "Las pólizas se cargan desde la ficha del cliente. Buscalo y entrá a su ficha.",
      },
      {
        element: '[data-tour="upload-policies"]',
        title: "2a. Si tenés el PDF de la póliza",
        description:
          "Tocá «Cargar pólizas desde PDF» y elegí el archivo. El sistema lee el documento y completa los datos solo. Revisalos antes de guardar.",
      },
      {
        element: '[data-tour="manual-policy"]',
        title: "2b. Si preferís escribirla",
        description: "Tocá «Cargar póliza manual» y completá número, aseguradora, tipo y fechas de vigencia.",
      },
    ],
  },

  renovar: {
    id: "renovar",
    title: "Cómo renovar una póliza",
    steps: [
      {
        element: '[data-tour="renewals-search"]',
        title: "1. Encontrá la póliza",
        description:
          "La lista ya viene ordenada: primero las que vencen antes. Si buscás una en particular, escribí el cliente o el número.",
      },
      {
        element: '[data-tour="renewals-list"]',
        title: "2. Avisale al cliente",
        description:
          "Con el botón verde de WhatsApp le mandás un mensaje ya escrito. Con el teléfono lo llamás.",
      },
      {
        element: '[data-tour="renewals-list"]',
        title: "3. Anotá en qué quedó",
        description:
          "En el menú de estado elegí «Contactado» o «En proceso». Así sabés a quién ya llamaste.",
      },
      {
        element: '[data-tour="renewals-list"]',
        title: "4. Cuando llega la póliza nueva",
        description:
          "Tocá «Renovar», subí el PDF nuevo y revisá las fechas. Al guardar, la póliza pasa a «Renovada» y sale de esta lista.",
      },
    ],
  },

  cobranza: {
    id: "cobranza",
    title: "Cómo gestionar un cobro",
    steps: [
      {
        element: '[data-tour="page-header"]',
        title: "Una tarjeta por persona",
        description:
          "Cada tarjeta es alguien que debe, con todas sus cuotas juntas. Están en columnas según en qué quedó la gestión.",
      },
      {
        title: "Registrar lo que pasó",
        description:
          "Entrá a la tarjeta y tocá «Registrar gestión» cuando hablaste con la persona, o «Registrar pago» cuando pagó.",
      },
      {
        title: "Volver a llamar",
        description:
          "Al registrar una gestión podés poner la fecha para volver a contactarlo. Ese día aparece en Inicio.",
      },
    ],
  },
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    path: "/admin",
    title: "Inicio",
    intro: "Esta pantalla te dice qué hay que hacer hoy. Si una lista está vacía, es porque está todo al día.",
    questions: [
      {
        question: "¿Qué significa cada bloque?",
        answer:
          "«Vencen esta semana» son pólizas que hay que renovar ya. «Cumpleaños de hoy» son clientes para saludar. «Cobros para hoy» son personas que quedaste en volver a llamar.",
      },
      {
        question: "¿Cómo busco un cliente?",
        answer: "Usá el buscador de arriba. Escribí nombre, cédula o número de póliza.",
        tourId: "buscar-cliente",
      },
      {
        question: "Quiero ver el recorrido de bienvenida otra vez",
        answer: "Tocá el botón de abajo y te vuelvo a mostrar dónde está cada cosa.",
        tourId: "bienvenida",
      },
    ],
  },
  {
    path: "/admin/clientes",
    title: "Clientes",
    intro: "Acá está toda la cartera. Tocá un cliente para ver su ficha con sus pólizas y datos de contacto.",
    questions: [
      {
        question: "¿Cómo agrego un cliente nuevo?",
        answer: "Con el botón «Nuevo cliente» arriba a la derecha. Solo el nombre es obligatorio.",
        tourId: "nuevo-cliente",
      },
      {
        question: "¿Cómo le cargo una póliza a un cliente?",
        answer:
          "Entrá a la ficha del cliente. Si tenés el PDF, usá «Cargar pólizas desde PDF» y el sistema completa los datos solo. Si no, «Cargar póliza manual».",
        tourId: "cargar-poliza",
      },
      {
        question: "¿Cómo le escribo por WhatsApp?",
        answer:
          "Tocá el ícono verde de WhatsApp al lado del cliente. Se abre WhatsApp con el número ya puesto. El cliente tiene que tener teléfono cargado.",
      },
      {
        question: "¿Qué es «Enviar credenciales»?",
        answer:
          "Le manda al cliente un email con usuario y contraseña para que vea sus propias pólizas desde su casa. Es opcional.",
      },
    ],
  },
  {
    path: "/admin/polizas",
    title: "Pólizas",
    intro: "Todas las pólizas cargadas, de todos los clientes. Usá el buscador para encontrar una por número, cliente o aseguradora.",
    questions: [
      {
        question: "¿Cómo cargo una póliza nueva?",
        answer: "Las pólizas se cargan desde la ficha del cliente.",
        tourId: "cargar-poliza",
      },
      {
        question: "¿Cómo le mando la póliza al cliente?",
        answer: "Con el botón verde de WhatsApp de la fila. El mensaje ya lleva el enlace para descargar el PDF.",
      },
    ],
  },
  {
    path: "/admin/polizas/por-vencer",
    title: "Pólizas por vencer",
    intro:
      "Las pólizas que vencen en los próximos 60 días, empezando por las más urgentes. En rojo: vencen en una semana o menos.",
    questions: [
      {
        question: "¿Cómo renuevo una póliza?",
        answer:
          "Avisale al cliente, anotá el estado y, cuando tengas la póliza nueva, tocá «Renovar» y subí el PDF.",
        tourId: "renovar",
      },
      {
        question: "¿Qué quiere decir cada estado?",
        answer:
          "Pendiente: nadie lo contactó. Contactado: ya le avisaste. En proceso: está renovando. Renovada: listo. No renovada: decidió no seguir.",
      },
      {
        question: "Una póliza renovada volvió a aparecer",
        answer:
          "Es normal: 15 días antes de su nuevo vencimiento vuelve a la lista como «Pendiente» para que no se te pase el año siguiente.",
      },
    ],
  },
  {
    path: "/admin/facturacion",
    title: "Facturación",
    intro: "Cuánto suma la prima de las pólizas, por aseguradora y por tipo, en pesos y en dólares por separado.",
    questions: [
      {
        question: "¿Qué es «Sin dato»?",
        answer:
          "Pólizas que no tienen la prima cargada. Si querés que sumen, entrá a la póliza y completá el importe.",
      },
    ],
  },
  {
    path: "/admin/siniestros",
    title: "Siniestros",
    intro: "Cada choque, robo o daño que un cliente denunció, y en qué paso está.",
    questions: [
      {
        question: "¿Cómo registro un siniestro?",
        answer:
          "Tocá «Nuevo siniestro», buscá la póliza del cliente y contá qué pasó. Después lo vas avanzando a medida que responde la aseguradora.",
      },
      {
        question: "¿Por qué me pide un motivo?",
        answer:
          "Para cerrar, resolver o reabrir un siniestro hay que dejar escrito por qué. Queda en el historial.",
      },
    ],
  },
  {
    path: "/admin/cobranza",
    title: "Cobranza",
    intro: "Quién debe, cuánto y en qué quedó cada gestión. Se llama a la persona, no a la cuota.",
    questions: [
      {
        question: "¿Cómo registro que alguien pagó?",
        answer: "Entrá a la tarjeta de la persona y tocá «Registrar pago».",
        tourId: "cobranza",
      },
      {
        question: "¿Cómo cargo las deudas que me manda la compañía?",
        answer:
          "Con «Importar cartera» subís la planilla de la aseguradora. El sistema te muestra una vista previa antes de aplicar nada.",
      },
    ],
  },
  {
    path: "/admin/cumpleanos",
    title: "Cumpleaños",
    intro: "Los próximos cumpleaños de tus clientes, empezando por los más cercanos.",
    questions: [
      {
        question: "¿Cómo lo saludo?",
        answer: "Tocá el botón de WhatsApp: se abre con un saludo ya escrito que podés cambiar antes de mandar.",
      },
      {
        question: "Falta un cliente",
        answer: "Solo aparecen los que tienen fecha de nacimiento cargada. Agregala desde la ficha del cliente.",
      },
    ],
  },
]

export function helpForPath(pathname: string): HelpSection {
  const matches = HELP_SECTIONS.filter(
    (section) => pathname === section.path || pathname.startsWith(`${section.path}/`),
  )
  return matches.sort((a, b) => b.path.length - a.path.length)[0] ?? HELP_SECTIONS[0]
}
