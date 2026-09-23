import { PageHeader } from "@/components/brand/page-header"
import { AdminLayout } from "@/components/admin-layout"
import { BirthdaysContent } from "@/components/birthdays-content"
import { createClient } from "@/lib/supabase/server"

export default async function BirthdaysPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("clients")
    .select("id, nombre, telefono, fecha_nacimiento")
    .not("fecha_nacimiento", "is", null)

  if (error) console.error("Error fetching clients:", error)

  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Clientes"
          title="Cumpleaños"
          description="Los próximos cumpleaños, empezando por los más cercanos. Un saludo a tiempo fideliza."
        />
        <BirthdaysContent clients={(data as any) || []} />
      </div>
    </AdminLayout>
  )
}
