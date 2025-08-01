import { createClient } from "@/lib/supabase/server";
import { ClientLayout } from "@/components/client-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

async function getClientData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { clientName: "Tu", policies: [] };
  }

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("client_id, clients(nombre)")
    .eq("id", user.id)
    .single();

  if (!profileData || !profileData.client_id) {
    return { clientName: "Tu", policies: [] };
  }

  const { data: policiesData } = await supabase
    .from("policies")
    .select("*, companies(name)")
    .eq("client_id", profileData.client_id)
    .order("vigencia_fin", { ascending: true });

  return {
    clientName: (profileData.clients as any)?.nombre || "Tu",
    policies: policiesData || [],
  };
}

export default async function ClientDashboard() {
  const { clientName, policies } = await getClientData();

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Bienvenido, {clientName}!</h1>
          <p className="text-muted-foreground">Aquí puedes ver tus pólizas activas y su historial.</p>
        </div>
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