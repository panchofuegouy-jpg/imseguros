"use client"

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";

interface Policy {
  id: string;
  client_id: string;
  company_id: string | null;
  numero_poliza: string;
  tipo: string;
  vigencia_inicio: string;
  vigencia_fin: string;
  archivo_url: string | null;
  notas: string | null;
  created_at: string;
  clients?: { nombre: string } | null; // To fetch client name
  companies?: { name: string } | null; // To fetch company name
}

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAllPolicies() {
      try {
        const { data, error } = await supabase
          .from("policies")
          .select("*, clients(nombre), companies(name)") // Select policies and join client and company names
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }
        setPolicies(data as Policy[]);
      } catch (err: any) {
        console.error("Error fetching all policies:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchAllPolicies();
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="text-red-500">Error: {error}</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Historial de Pólizas</h1>
          <p className="text-muted-foreground">Todas las pólizas registradas en el sistema.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Listado Completo de Pólizas</CardTitle>
          </CardHeader>
          <CardContent>
            {policies.length === 0 ? (
              <p>No hay pólizas registradas en el sistema.</p>
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
                  {policies.map((policy) => (
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
    </AdminLayout>
  );
}