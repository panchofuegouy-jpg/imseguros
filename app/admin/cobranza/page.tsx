import Link from "next/link"
import { AdminLayout } from "@/components/admin-layout"
import { Button } from "@/components/ui/button"
import { CollectionsBoard } from "@/components/operations/collections-board"
import { CreateObligationDialog } from "@/components/operations/create-obligation-dialog"
import { createClient } from "@/lib/supabase/server"

export default async function CobranzaPage() {
  const supabase = await createClient()
  const { data: companies } = await supabase.from("companies").select("id, name").order("name")

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">OPERACIONES</p>
            <h1 className="text-3xl font-bold">Cobranza</h1>
            <p className="text-muted-foreground">
              Una tarjeta por persona, con toda su deuda junta. Se llama al deudor, no a la cuota.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/admin/cobranza/importar">Importar cartera</Link></Button>
            <CreateObligationDialog companies={companies || []} />
          </div>
        </div>
        <CollectionsBoard basePath="/admin" />
      </div>
    </AdminLayout>
  )
}
