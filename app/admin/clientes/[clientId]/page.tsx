import { createClient } from "@/lib/supabase/server";
import { fetchAllSupabaseRows } from "@/lib/supabase/fetch-all";
import { AdminLayout } from "@/components/admin-layout";
import { ClientDetailPageContent } from "@/components/client-detail-page-content";
import { headers } from "next/headers";
import { createPoliciesShareToken } from "@/lib/share-link";

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

  // % de aumento en renovación (tabla solo para admins). Sin fila = 3 %.
  const { data: renewalSettings } = await supabase
    .from("client_renewal_settings")
    .select("aumento_renovacion_pct")
    .eq("client_id", clientId)
    .maybeSingle();
  const clientWithSettings = {
    ...client,
    aumento_renovacion_pct: renewalSettings ? Number(renewalSettings.aumento_renovacion_pct) : 3,
  };

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
    client: clientWithSettings,
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

  // El link público usa el dominio desde donde se abre la app (NEXT_PUBLIC_APP_URL apunta al sitio web, no a la app).
  const host = (await headers()).get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const policiesShareUrl = `${protocol}://${host}/p/${createPoliciesShareToken(client.id)}`;

  return (
    <AdminLayout>
      <ClientDetailPageContent client={client} initialPolicies={policies} companies={companies} hasAccount={hasAccount} policiesShareUrl={policiesShareUrl} />
    </AdminLayout>
  );
}
