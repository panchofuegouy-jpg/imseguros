import { PageHeader } from "@/components/brand/page-header"
import { AdminLayout } from "@/components/admin-layout";
import { PoliciesNearExpirationContent } from "@/components/policies-near-expiration-content";

export default function PoliciesNearExpirationPage() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Renovaciones"
          title="Pólizas por vencer"
          description="Las que vencen en los próximos 60 días, primero las más urgentes. Avisale al cliente y anotá en qué quedó."
        />
        <PoliciesNearExpirationContent />
      </div>
    </AdminLayout>
  );
}
