import Link from "next/link"
import { AdminLayout } from "@/components/admin-layout"
import { Button } from "@/components/ui/button"
import { CollectionImportWizard } from "@/components/operations/collection-import-wizard"

export default function ImportarCobranzaPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <Button asChild variant="link" className="px-0"><Link href="/admin/cobranza">← Volver a cobranza</Link></Button>
          <h1 className="text-3xl font-bold">Importar cartera</h1>
          <p className="text-muted-foreground">Cargá, mapeá y revisá un lote antes de aplicarlo.</p>
        </div>
        <CollectionImportWizard />
      </div>
    </AdminLayout>
  )
}
