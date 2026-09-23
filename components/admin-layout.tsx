"use client"

import React, { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  Cake,
  CalendarClock,
  FileText,
  HandCoins,
  Home,
  Plus,
  ShieldAlert,
  Users,
} from "lucide-react"
import { getCurrentUser, signOut } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { LoadingScreen } from "@/components/ui/spinner"
import { AppShell, type NavGroup, type NavItem } from "@/components/shell/app-shell"
import { GlobalSearch } from "@/components/shell/global-search"
import { HelpPanel } from "@/components/help/help-panel"
import { hasSeenTour, startTour } from "@/components/help/tour"
import { CreateClientDialog } from "@/components/create-client-dialog"
import { ShellUserContext } from "@/components/shell/user-context"

interface AdminLayoutProps {
  children: React.ReactNode
  /** @deprecated El título va en la página con <PageHeader>. Se mantiene por compatibilidad. */
  headerTitle?: string
  headerDescription?: string
}

const inicio: NavItem = { name: "Inicio", href: "/admin", icon: Home }
const clientes: NavItem = { name: "Clientes", href: "/admin/clientes", icon: Users }
const polizas: NavItem = { name: "Pólizas", href: "/admin/polizas", icon: FileText }
const porVencer: NavItem = { name: "Por vencer", href: "/admin/polizas/por-vencer", icon: CalendarClock }
const cobranza: NavItem = { name: "Cobranza", href: "/admin/cobranza", icon: HandCoins }

const NAV_GROUPS: NavGroup[] = [
  { label: "Día a día", items: [inicio, clientes, polizas, porVencer] },
  {
    label: "Gestión",
    items: [
      cobranza,
      { name: "Siniestros", href: "/admin/siniestros", icon: ShieldAlert },
      { name: "Cumpleaños", href: "/admin/cumpleanos", icon: Cake },
      { name: "Facturación", href: "/admin/facturacion", icon: BarChart3 },
    ],
  },
]

const MOBILE_TABS: NavItem[] = [inicio, clientes, porVencer, cobranza]

export function AdminLayout({ children }: AdminLayoutProps) {
  const [user, setUser] = useState<any>(null)
  const [newClientOpen, setNewClientOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    async function checkUser() {
      const userData = await getCurrentUser()
      if (!userData || userData.profile?.role !== "admin") {
        router.push("/login")
        return
      }
      setUser(userData)
    }
    checkUser()
  }, [router])

  // La primera vez que entra al Inicio, el recorrido de bienvenida arranca solo.
  useEffect(() => {
    if (!user || pathname !== "/admin" || hasSeenTour("bienvenida")) return
    const timeout = setTimeout(() => startTour("bienvenida"), 900)
    return () => clearTimeout(timeout)
  }, [user, pathname])

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  const displayName =
    user?.profile?.nombre ||
    user?.profile?.name ||
    user?.user?.user_metadata?.full_name ||
    user?.user?.user_metadata?.name ||
    user?.user?.email?.split("@")[0] ||
    "Usuario"

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingScreen />
      </div>
    )
  }

  return (
    <ShellUserContext.Provider value={{ displayName }}>
    <AppShell
      groups={NAV_GROUPS}
      mobileTabs={MOBILE_TABS}
      userName={displayName}
      userRole="Administración"
      onSignOut={handleSignOut}
      pageActionsId="admin-topbar-actions"
      topbar={
        <>
          <div className="min-w-0 flex-1">
            <GlobalSearch />
          </div>
          <Button data-tour="new" onClick={() => setNewClientOpen(true)} className="rounded-full">
            <Plus aria-hidden />
            <span className="hidden sm:inline">Nuevo cliente</span>
            <span className="sr-only sm:hidden">Nuevo cliente</span>
          </Button>
          <HelpPanel />
          <CreateClientDialog
            open={newClientOpen}
            onOpenChange={setNewClientOpen}
            onClientCreated={() => {
              router.refresh()
              // Las pantallas que cargan clientes en el navegador escuchan este aviso.
              window.dispatchEvent(new Event("isgleas:clients-changed"))
            }}
          />
        </>
      }
    >
      {children}
    </AppShell>
    </ShellUserContext.Provider>
  )
}
