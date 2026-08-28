import { AdminLayout } from "@/components/admin-layout"
import { OperationDetail } from "@/components/operations/operation-detail"

export default async function ClaimDetailPage({ params }: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await params
  return (
    <AdminLayout>
      <OperationDetail id={claimId} basePath="/admin" />
    </AdminLayout>
  )
}
