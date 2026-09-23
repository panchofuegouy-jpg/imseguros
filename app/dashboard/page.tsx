"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { LoadingScreen } from "@/components/ui/spinner"

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function checkUser() {
      const userData = await getCurrentUser()

      if (!userData) {
        router.push("/login")
        return
      }

      // Redirect based on role
      if (userData.profile?.role === "admin") {
        router.push("/admin")
      } else {
        router.push("/cliente")
      }
    }

    checkUser()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingScreen label="Redirigiendo..." />
      </div>
    )
  }

  return null
}
