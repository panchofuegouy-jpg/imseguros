import { createClient } from "@/lib/supabase/server";
import { ClientLayout } from "@/components/client-layout";

async function getClientName() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return "Tu";
  }

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("clients(nombre)")
    .eq("id", user.id)
    .single();

  return (profileData?.clients as any)?.nombre || "Tu";
}

export default async function ClientDashboard() {
  const clientName = await getClientName();

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Bienvenido, {clientName}!</h1>
          <p className="text-muted-foreground">Aquí puedes ver un resumen de tu información.</p>
        </div>
      </div>
    </ClientLayout>
  );
}
