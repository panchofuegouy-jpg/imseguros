import { PageHeader } from "@/components/brand/page-header"
import { AdminLayout } from "@/components/admin-layout"
import { ClaimsInbox } from "@/components/operations/operations-inboxes"

export default function ClaimsPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Gestión"
          title="Siniestros"
          description="Cada choque, robo o daño denunciado y en qué paso está con la aseguradora."
        />
        <ClaimsInbox basePath="/admin" />
      </div>
    </AdminLayout>
  )
}
