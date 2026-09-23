"use client"

import { LoadingScreen } from "@/components/ui/spinner"
import { PageHeader } from "@/components/brand/page-header"
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
        id,
        nombre,
        email,
        telefono,
        documento,
        numero_cliente,
        created_at,
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
    // «Nuevo cliente» de la barra superior avisa cuando crea uno.
    window.addEventListener("isgleas:clients-changed", getClients)
    return () => window.removeEventListener("isgleas:clients-changed", getClients)
  }, [])

  if (loading) {
    return (
      <AdminLayout>
        <LoadingScreen label="Cargando clientes…" />
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Cartera"
          title="Clientes"
          description="Tocá un cliente para ver su ficha, sus pólizas y sus datos de contacto."
        />
        <ClientPageContent initialClients={clients} onClientsUpdate={getClients} />
      </div>
    </AdminLayout>
  )
}
