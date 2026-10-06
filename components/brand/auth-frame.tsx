import type { ReactNode } from "react"

/**
 * Marco de las pantallas de acceso (login, recuperar y cambiar contraseña).
 * A la izquierda la marca sobre petróleo; a la derecha el formulario, sin caja.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative flex min-h-0 flex-row items-center justify-between overflow-hidden bg-sidebar px-5 py-4 text-sidebar-foreground sm:px-10 lg:min-h-screen lg:flex-col lg:items-stretch lg:px-14 lg:py-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/nuevo-logo-isgleas-seguros.webp" alt="Isgleas Seguros" className="h-9 w-auto self-start sm:h-10 lg:h-14" />
        <p className="text-right text-xs text-sidebar-foreground/75 sm:text-sm lg:hidden">Isgleas Seguros<br />Paysandú, Uruguay</p>
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
        <p className="hidden text-sm text-sidebar-foreground/60 lg:block">Isgleas Seguros · Paysandú, Uruguay</p>
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
      <main className="flex items-start justify-center px-5 py-8 sm:px-8 lg:items-center lg:py-10 [&_[data-slot=card]]:w-full [&_[data-slot=card]]:max-w-md [&_[data-slot=card]]:rounded-2xl [&_[data-slot=card]]:border [&_[data-slot=card]]:border-border/70 [&_[data-slot=card]]:bg-card [&_[data-slot=card]]:p-5 [&_[data-slot=card]]:shadow-sm sm:[&_[data-slot=card]]:p-7 lg:[&_[data-slot=card]]:rounded-none lg:[&_[data-slot=card]]:border-0 lg:[&_[data-slot=card]]:bg-transparent lg:[&_[data-slot=card]]:p-0 lg:[&_[data-slot=card]]:shadow-none [&_[data-slot=card-header]]:px-0 [&_[data-slot=card-content]]:px-0 [&_[data-slot=card-title]]:font-display [&_[data-slot=card-title]]:text-3xl [&_[data-slot=card-title]]:font-medium sm:[&_[data-slot=card-title]]:text-4xl [&_[data-slot=card-description]]:text-sm sm:[&_[data-slot=card-description]]:text-base">
        {children}
      </main>
    </div>
  )
}
