"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"

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
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Redirigiendo...</p>
        </div>
      </div>
    )
  }

  return null
}
