"use client"

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ClientLayout } from "@/components/client-layout";
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
  companies?: { name: string } | null; // To fetch company name
}

export default function ClientDashboard() {
  const [clientName, setClientName] = useState("Tu");
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClientData() {
      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) throw userError || new Error("User not logged in");

        const userId = userData.user.id;

        // Fetch user profile to get client_id and client name
        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("client_id, clients(nombre)")
          .eq("id", userId)
          .single();

        if (profileError || !profileData || !profileData.client_id) {
          throw profileError || new Error("Client profile not found or not associated with a client.");
        }

        const client_id = profileData.client_id;
        if (profileData.clients?.nombre) {
          setClientName(profileData.clients.nombre);
        }

        // Fetch policies for this client_id
        const { data: policiesData, error: policiesError } = await supabase
          .from("policies")
          .select("*, companies(name)")
          .eq("client_id", client_id)
          .order("vigencia_fin", { ascending: true });

        if (policiesError) throw policiesError;
        setPolicies(policiesData as Policy[]);

      } catch (err: any) {
        console.error("Error fetching client data:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchClientData();
  }, []);

  if (loading) {
    return (
      <ClientLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </ClientLayout>
    );
  }

  if (error) {
    return (
      <ClientLayout>
        <div className="text-red-500">Error: {error}</div>
      </ClientLayout>
    );
  }

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
                  {policies.map((policy) => (
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