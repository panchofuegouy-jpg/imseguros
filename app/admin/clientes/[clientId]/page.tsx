import { createClient } from "@/lib/supabase/server";
import { fetchAllSupabaseRows } from "@/lib/supabase/fetch-all";
import { AdminLayout } from "@/components/admin-layout";
import { ClientDetailPageContent } from "@/components/client-detail-page-content";

async function getClientData(clientId: string) {
  const supabase = await createClient()

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (clientError) {
    console.error("Error fetching client:", clientError);
    return { client: null, policies: [], companies: [], hasAccount: false };
  }

  const { data: policies, error: policiesError } = await fetchAllSupabaseRows((from, to) =>
    supabase
      .from("policies")
      .select("*, companies(name)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .range(from, to)
  );

  if (policiesError) {
    console.error("Error fetching policies:", policiesError);
  }

  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, name");

  if (companiesError) {
    console.error("Error fetching companies:", companiesError);
  }

  // Check if client has an account
  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("client_id", clientId)
    .single();

  return {
    client,
    policies: policies || [],
    companies: companies || [],
    hasAccount: !!userProfile,
  };
}

export default async function ClientDetailsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { client, policies, companies, hasAccount } = await getClientData(clientId);

  if (!client) {
    return (
      <AdminLayout>
        <div className="text-center py-8">Cliente no encontrado.</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <ClientDetailPageContent client={client} initialPolicies={policies} companies={companies} hasAccount={hasAccount} />
    </AdminLayout>
  );
}
