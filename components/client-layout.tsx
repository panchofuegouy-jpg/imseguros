"use client"

import React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser, signOut } from "@/lib/auth"
import { FileText, Home } from "lucide-react"
import { ChangePasswordDialog } from "@/components/change-password-dialog"
import { useFirstLogin } from "@/hooks/use-first-login"
import { LoadingScreen } from "@/components/ui/spinner"
import { AppShell } from "@/components/shell/app-shell"

interface ClientLayoutProps {
  children: React.ReactNode
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const { needsPasswordChange, markPasswordChanged, loading: firstLoginLoading } = useFirstLogin()

  useEffect(() => {
    async function checkUser() {
      const userData = await getCurrentUser()
      if (!userData || userData.profile?.role !== "client") {
        router.push("/login")
        return
      }
      setUser(userData)
    }
    checkUser()
  }, [router])

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  const navigation = [
    { name: "Inicio", href: "/cliente", icon: Home },
    { name: "Mis pólizas", href: "/cliente/polizas", icon: FileText },
  ]

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingScreen />
      </div>
    )
  }

  const displayName = user?.profile?.client?.nombre || user?.user?.email?.split("@")[0] || "Cliente"

  return (
    <>
      <AppShell
        groups={[{ items: navigation }]}
        mobileTabs={navigation}
        userName={displayName}
        userRole="Mi cuenta"
        onSignOut={handleSignOut}
      >
        {children}
      </AppShell>

      {/* Dialog de cambio de contraseña obligatorio */}
      <ChangePasswordDialog
        open={!!needsPasswordChange && !firstLoginLoading}
        onPasswordChanged={markPasswordChanged}
      />
    </>
  )
}
