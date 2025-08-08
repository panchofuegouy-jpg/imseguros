"use client"

import { createClient } from "@/lib/supabase/client"
import { AdminLayout } from "@/components/admin-layout"
import { ClientPageContent } from "@/components/client-page-content"
import { useEffect, useState } from "react"

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function getClients() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("clients")
      .select(
        `
        *,
        policies(count)
      `,
      )
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching clients:", error)
      setClients([])
    } else {
      setClients(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    getClients()
  }, [])

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-64">
          <p>Cargando clientes...</p>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <ClientPageContent initialClients={clients} onClientsUpdate={getClients} />
    </AdminLayout>
  )
}
