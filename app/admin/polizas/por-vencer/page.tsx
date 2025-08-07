
import { createClient } from "@/lib/supabase/server";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";

async function getPoliciesNearExpiration() {
  const supabase = await createClient();
  const today = new Date();
  const nextMonth = new Date();
  nextMonth.setDate(today.getDate() + 30);

  const { data, error } = await supabase
    .from("policies")
    .select("*, clients(nombre), companies(name)")
    .gte("vigencia_fin", today.toISOString())
    .lte("vigencia_fin", nextMonth.toISOString())
    .order("vigencia_fin", { ascending: true });

  if (error) {
    console.error("Error fetching policies near expiration:", error);
    return [];
  }

  return data;
}

export default async function PoliciesNearExpirationPage() {
  const policies = await getPoliciesNearExpiration();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Pólizas por Vencer</h1>
          <p className="text-muted-foreground">Pólizas que vencerán en los próximos 30 días.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Listado de Pólizas por Vencer</CardTitle>
          </CardHeader>
          <CardContent>
            {policies.length === 0 ? (
              <p>No hay pólizas por vencer en los próximos 30 días.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número de Póliza</TableHead>
                    <TableHead>Cliente</TableHead>
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
                      <TableCell>
                        <Link href={`/admin/clientes/${policy.client_id}`} className="text-blue-600 hover:underline">
                          {policy.clients?.nombre || "N/A"}
                        </Link>
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
                                className="text-blue-600 hover:underline"
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
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
