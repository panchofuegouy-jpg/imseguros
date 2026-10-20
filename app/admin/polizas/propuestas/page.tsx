import { AdminLayout } from "@/components/admin-layout"
import { PageHeader } from "@/components/brand/page-header"
import { RenewalProposalsWizard } from "@/components/renewal-proposals-wizard"

export default function PropuestasRenovacionPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Pólizas"
          title="Propuestas de renovación"
          description="Subí el Excel de cotizaciones de BSE. Armamos la propuesta de cada cliente con su aumento y la dejamos en su ficha para mandarla por WhatsApp."
        />
        <RenewalProposalsWizard />
      </div>
    </AdminLayout>
  )
}
