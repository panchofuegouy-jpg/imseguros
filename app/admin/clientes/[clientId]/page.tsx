import { createClient } from "@/lib/supabase/server";
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
    return { client: null, policies: [], companies: [] };
  }

  const { data: policies, error: policiesError } = await supabase
    .from("policies")
    .select("*, companies(name)")
    .eq("client_id", clientId);

  if (policiesError) {
    console.error("Error fetching policies:", policiesError);
  }

  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("id, name");

  if (companiesError) {
    console.error("Error fetching companies:", companiesError);
  }

  return {
    client,
    policies: policies || [],
    companies: companies || [],
  };
}

export default async function ClientDetailsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { client, policies, companies } = await getClientData(clientId);

  if (!client) {
    return (
      <AdminLayout>
        <div className="text-center py-8">Cliente no encontrado.</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <ClientDetailPageContent client={client} initialPolicies={policies} companies={companies} />
    </AdminLayout>
  );
}