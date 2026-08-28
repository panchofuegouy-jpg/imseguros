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
        <div>
          <h1 className="text-2xl font-semibold">Cumpleaños</h1>
          <p className="text-muted-foreground">Los próximos cumpleaños de la cartera, ordenados por cercanía.</p>
        </div>
        <BirthdaysContent clients={(data as any) || []} />
      </div>
    </AdminLayout>
  )
}
