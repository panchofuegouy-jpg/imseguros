import { createClient } from "@/lib/supabase/server";
import { ClientLayout } from "@/components/client-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

  const { data: policiesData } = await supabase
    .from("policies")
    .select("*, companies(name), clients(nombre)") // 👈 importante incluir clients
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
                    <TableHead>Asegurado</TableHead>
                    <TableHead>Aseguradora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Inicio Vigencia</TableHead>
                    <TableHead>Fin Vigencia</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy: any) => {
                    const aseguradoNombre = policy.nombre_asegurado || policy.clients?.nombre || 'Sin nombre';

                    return (
                      <TableRow key={policy.id}>
                        <TableCell>{policy.numero_poliza}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{aseguradoNombre}</p>
                            {policy.parentesco && (
                              <p className="text-sm text-muted-foreground">{policy.parentesco}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{policy.companies?.name || "N/A"}</TableCell>
                        <TableCell>{policy.tipo}</TableCell>
                        <TableCell>{policy.vigencia_inicio}</TableCell>
                        <TableCell>{policy.vigencia_fin}</TableCell>
                        <TableCell>
                          {policy.archivo_urls && Array.isArray(policy.archivo_urls) && policy.archivo_urls.length > 0 ? (
                            <div className="flex flex-col space-y-1">
                              {policy.archivo_urls.map((url, index) => (
                                <a
                                  key={index}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  Archivo {index + 1}
                                </a>
                              ))}
                            </div>
                          ) : (
                            "N/A"
                          )}
                        </TableCell>
                        <TableCell>{policy.notas}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
}
