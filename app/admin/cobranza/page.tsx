import { PageHeader } from "@/components/brand/page-header"
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
        <PageHeader
          eyebrow="Gestión"
          title="Cobranza"
          description="Una tarjeta por persona, con toda su deuda junta. Se llama a la persona, no a la cuota."
          actions={
            <>
              <Button asChild variant="outline"><Link href="/admin/cobranza/importar">Importar cartera</Link></Button>
              <CreateObligationDialog companies={companies || []} />
            </>
          }
        />
        <CollectionsBoard basePath="/admin" />
      </div>
    </AdminLayout>
  )
}
