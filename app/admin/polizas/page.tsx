import { createClient } from "@/lib/supabase/server";
import { AdminLayout } from "@/components/admin-layout";
import { PoliciesHistoryContent } from "@/components/policies-history-content";

async function getPolicies() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("policies")
    .select("*, clients(nombre, numero_cliente), companies(name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching policies:", error);
    return [];
  }

  return data;
}

export default async function PoliciesPage() {
  const policies = await getPolicies();

  return (
    <AdminLayout>
      <PoliciesHistoryContent initialPolicies={policies} />
    </AdminLayout>
  );
}
