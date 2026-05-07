import { createClient } from "@/lib/supabase/server";
import { fetchAllSupabaseRows } from "@/lib/supabase/fetch-all";
import { ClientLayout } from "@/components/client-layout";
import { ClientPoliciesContent } from "@/components/client-policies-content";

async function getClientPolicies() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { policies: [] };

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("client_id")
    .eq("id", user.id)
    .single();

  if (!profileData?.client_id) return { policies: [] };

  const { data: policiesData, error } = await fetchAllSupabaseRows((from, to) =>
    supabase
      .from("policies")
      .select("*, companies(name), clients(nombre)")
      .eq("client_id", profileData.client_id)
      .order("vigencia_fin", { ascending: true })
      .range(from, to)
  );

  if (error) {
    console.error("Error fetching client policies:", error);
  }

  return {
    policies: policiesData || [],
  };
}
export default async function ClientPoliciesPage() {
  const { policies } = await getClientPolicies();

  return (
    <ClientLayout>
      <ClientPoliciesContent initialPolicies={policies} />
    </ClientLayout>
  );
}
