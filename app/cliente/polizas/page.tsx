import { createClient } from "@/lib/supabase/server";
import { ClientLayout } from "@/components/client-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

async function getClientPolicies() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { policies: [] };
  }

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("client_id")
    .eq("id", user.id)
    .single();

  if (!profileData || !profileData.client_id) {
    return { policies: [] };
  }

  const { data: policiesData } = await supabase
    .from("policies")
    .select("*, companies(name)")
    .eq("client_id", profileData.client_id)
    .order("vigencia_fin", { ascending: true });

  return {
    policies: policiesData || [],
  };
}

export default async function ClientPoliciesPage() {
  const { policies } = await getClientPolicies();

  return (
    <ClientLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Mis Pólizas</CardTitle>
          </CardHeader>
          <CardContent>
            {policies.length === 0 ? (
              <p>No tienes pólizas registradas.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número de Póliza</TableHead>
                    <TableHead>Aseguradora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Inicio Vigencia</TableHead>
                    <TableHead>Fin Vigencia</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy: any) => (
                    <TableRow key={policy.id}>
                      <TableCell>{policy.numero_poliza}</TableCell>
                      <TableCell>{policy.companies?.name || "N/A"}</TableCell>
                      <TableCell>{policy.tipo}</TableCell>
                      <TableCell>{policy.vigencia_inicio}</TableCell>
                      <TableCell>{policy.vigencia_fin}</TableCell>
                      <TableCell>
                        {policy.archivo_url ? (
                          <a href={policy.archivo_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            Ver Archivo
                          </a>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell>{policy.notas}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
}
