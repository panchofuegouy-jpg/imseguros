import type { ReactNode } from "react"

/**
 * Marco de las pantallas de acceso (login, recuperar y cambiar contraseña).
 * A la izquierda la marca sobre petróleo; a la derecha el formulario, sin caja.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative flex flex-col justify-between overflow-hidden bg-sidebar px-6 py-6 text-sidebar-foreground sm:px-10 lg:px-14 lg:py-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/nuevo-logo-isgleas-seguros.webp" alt="Isgleas Seguros" className="h-10 w-auto self-start lg:h-14" />
        <div className="hidden space-y-6 lg:block">
          <span className="gold-rule block" aria-hidden />
          <p className="font-display text-5xl leading-[1.08] text-white">
            Tu cartera,
            <br />
            en orden y a mano.
          </p>
          <p className="max-w-sm text-lg text-sidebar-foreground">
            Clientes, pólizas, vencimientos y cobranza en un solo lugar.
          </p>
        </div>
        <p className="hidden text-sm text-sidebar-foreground/60 lg:block">Isgleas Seguros · Montevideo, Uruguay</p>
        {/* Arco decorativo en latón */}
        <svg
          aria-hidden
          className="pointer-events-none absolute -right-40 -bottom-40 hidden size-[520px] text-gold/25 lg:block"
          viewBox="0 0 100 100"
          fill="none"
        >
          <circle cx="50" cy="50" r="49" stroke="currentColor" strokeWidth="0.4" />
          <circle cx="50" cy="50" r="38" stroke="currentColor" strokeWidth="0.4" />
        </svg>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8 [&_[data-slot=card]]:w-full [&_[data-slot=card]]:max-w-md [&_[data-slot=card]]:border-0 [&_[data-slot=card]]:bg-transparent [&_[data-slot=card]]:shadow-none [&_[data-slot=card-header]]:px-0 [&_[data-slot=card-content]]:px-0 [&_[data-slot=card-title]]:font-display [&_[data-slot=card-title]]:text-4xl [&_[data-slot=card-title]]:font-medium [&_[data-slot=card-description]]:text-base">
        {children}
      </main>
    </div>
  )
}
