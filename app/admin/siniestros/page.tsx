import { AdminLayout } from "@/components/admin-layout"
import { ClaimsInbox } from "@/components/operations/operations-inboxes"

export default function ClaimsPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Siniestros</h1>
          <p className="text-muted-foreground">Seguimiento de denuncias y transiciones auditadas.</p>
        </div>
        <ClaimsInbox basePath="/admin" />
      </div>
    </AdminLayout>
  )
}
