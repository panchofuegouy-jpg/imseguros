"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import type { LucideIcon } from "lucide-react"
import { LogOut, Menu, Moon, MoreHorizontal, Sun } from "lucide-react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
}

export interface NavGroup {
  label?: string
  items: NavItem[]
}

interface AppShellProps {
  children: ReactNode
  groups: NavGroup[]
  /** Hasta 4 accesos para la barra inferior del celular; el resto va en «Más». */
  mobileTabs: NavItem[]
  userName: string
  userRole: string
  onSignOut: () => void
  /** Contenido de la barra superior (buscador, botones). */
  topbar?: ReactNode
  /** id del contenedor donde las páginas montan sus propias acciones con un portal. */
  pageActionsId?: string
}

/** El item activo es el de href más largo que coincida con la ruta actual. */
function useActiveHref(items: NavItem[]) {
  const pathname = usePathname()
  const matches = items.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
  return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function SidebarNav({
  groups,
  activeHref,
  onNavigate,
}: {
  groups: NavGroup[]
  activeHref?: string
  onNavigate?: () => void
}) {
  return (
    <nav data-tour="nav" aria-label="Secciones" className="flex-1 space-y-7 overflow-y-auto px-3 py-6">
      {groups.map((group, index) => (
        <div key={group.label ?? index} className="space-y-1">
          {group.label && (
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/60">
              {group.label}
            </p>
          )}
          {group.items.map((item) => {
            const isActive = item.href === activeHref
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex h-12 items-center gap-3 rounded-xl px-3 text-base font-medium transition-colors duration-150",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                {isActive && (
                  <span aria-hidden className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-gold" />
                )}
                <item.icon className={cn("size-5 shrink-0", isActive ? "text-gold" : "opacity-80")} aria-hidden />
                <span className="truncate">{item.name}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function SidebarFooter({
  userName,
  userRole,
  onSignOut,
}: {
  userName: string
  userRole: string
  onSignOut: () => void
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <div className="space-y-2 border-t border-sidebar-border p-3">
      <div className="flex items-center gap-3 px-2 py-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gold/20 font-display text-base text-gold">
          {initials(userName) || "·"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold capitalize text-sidebar-accent-foreground">{userName}</p>
          <p className="truncate text-xs text-sidebar-foreground/70">{userRole}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-base text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      >
        {isDark ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
        {isDark ? "Modo claro" : "Modo oscuro"}
      </button>
      <button
        type="button"
        onClick={onSignOut}
        className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-base text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
      >
        <LogOut className="size-5" aria-hidden />
        Cerrar sesión
      </button>
    </div>
  )
}

function Logo() {
  return (
    <div className="flex h-20 shrink-0 items-center border-b border-sidebar-border px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/nuevo-logo-isgleas-seguros.webp" alt="Isgleas Seguros" className="h-11 w-auto" />
    </div>
  )
}

export function AppShell({
  children,
  groups,
  mobileTabs,
  userName,
  userRole,
  onSignOut,
  topbar,
  pageActionsId,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const allItems = groups.flatMap((group) => group.items)
  const activeHref = useActiveHref(allItems)
  const moreIsActive = !!activeHref && !mobileTabs.some((tab) => tab.href === activeHref)

  return (
    <div className="min-h-screen bg-background">
      {/* Menú lateral en celular */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-72 gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-72"
        >
          <SheetHeader className="p-0">
            <SheetTitle className="sr-only">Menú</SheetTitle>
            <Logo />
          </SheetHeader>
          <SidebarNav groups={groups} activeHref={activeHref} onNavigate={() => setMenuOpen(false)} />
          <SidebarFooter userName={userName} userRole={userRole} onSignOut={onSignOut} />
        </SheetContent>
      </Sheet>

      {/* Menú lateral en escritorio */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-30 lg:flex lg:w-64 lg:flex-col bg-sidebar text-sidebar-foreground">
        <Logo />
        <SidebarNav groups={groups} activeHref={activeHref} />
        <SidebarFooter userName={userName} userRole={userRole} onSignOut={onSignOut} />
      </aside>

      <div className="lg:pl-64">
        <div className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
          <div className="flex h-16 items-center gap-3 px-4 sm:h-[4.5rem] sm:gap-4 sm:px-6 lg:px-10">
            <button
              type="button"
              className="-ml-1 grid size-11 place-items-center rounded-full text-foreground hover:bg-muted lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menú"
            >
              <Menu className="size-6" />
            </button>
            {topbar}
          </div>
          {pageActionsId && (
            <div id={pageActionsId} className="flex items-center gap-3 border-t px-4 py-2.5 empty:hidden sm:px-6 lg:px-10" />
          )}
        </div>

        <main className="pb-28 pt-6 sm:pt-8 lg:pb-12">
          {/* key={pathname}: al cambiar de ruta el bloque se remonta y vuelve a
              entrar con la animación, en vez de aparecer de golpe. */}
          <div key={pathname} className="page-enter mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10">
            {children}
          </div>
        </main>
      </div>

      {/* Barra inferior en celular: las secciones de todos los días a un toque */}
      <nav
        aria-label="Accesos rápidos"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div
          className="mx-auto grid max-w-lg"
          style={{ gridTemplateColumns: `repeat(${mobileTabs.length + 1}, minmax(0, 1fr))` }}
        >
          {mobileTabs.map((tab) => {
            const isActive = tab.href === activeHref
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <tab.icon className="size-6" aria-hidden />
                <span className="truncate">{tab.name}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={cn(
              "flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold",
              moreIsActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <MoreHorizontal className="size-6" aria-hidden />
            Más
          </button>
        </div>
      </nav>
    </div>
  )
}
