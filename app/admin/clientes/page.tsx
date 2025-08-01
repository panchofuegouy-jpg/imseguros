import { createClient } from "@/lib/supabase/server"
import { AdminLayout } from "@/components/admin-layout"
import { ClientPageContent } from "@/components/client-page-content"

async function getClients() {
  const supabase = await createClient()
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
    return []
  }

  return data
}

export default async function ClientsPage() {
  const clients = await getClients()

  return (
    <AdminLayout>
      <ClientPageContent initialClients={clients} />
    </AdminLayout>
  )
}
