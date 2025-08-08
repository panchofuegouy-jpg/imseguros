import { AdminLayout } from "@/components/admin-layout";
import { PoliciesNearExpirationContent } from "@/components/policies-near-expiration-content";

export default function PoliciesNearExpirationPage() {
  return (
    <AdminLayout>
      <PoliciesNearExpirationContent />
    </AdminLayout>
  );
}
