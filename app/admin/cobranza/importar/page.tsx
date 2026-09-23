import { PageHeader } from "@/components/brand/page-header"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AdminLayout } from "@/components/admin-layout"
import { Button } from "@/components/ui/button"
import { CollectionImportWizard } from "@/components/operations/collection-import-wizard"

export default function ImportarCobranzaPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="space-y-4">
          <Button asChild variant="ghost" className="-ml-3"><Link href="/admin/cobranza"><ArrowLeft aria-hidden />Volver a cobranza</Link></Button>
          <PageHeader
            eyebrow="Cobranza"
            title="Importar cartera"
            description="Subí la planilla de la aseguradora. Antes de aplicar nada, te mostramos cómo va a quedar."
          />
        </div>
        <CollectionImportWizard />
      </div>
    </AdminLayout>
  )
}
