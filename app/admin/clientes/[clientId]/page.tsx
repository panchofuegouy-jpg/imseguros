"use client"

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PolicyForm from "@/components/policy-form";
import { Mail, Phone, FileText, User, CalendarDays } from "lucide-react";
import React from "react";

interface Client {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  documento: string;
  direccion: string | null;
  created_at: string;
}

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

interface Company {
  id: string;
  name: string;
}

export default function ClientDetailsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = React.use(params);
  const [client, setClient] = useState<Client | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch client details
        const { data: clientData, error: clientError } = await supabase
          .from("clients")
          .select("*")
          .eq("id", clientId)
          .single();
        if (clientError) throw clientError;
        setClient(clientData);

        // Fetch policies for this client
        const { data: policiesData, error: policiesError } = await supabase
          .from("policies")
          .select("*, companies(name)") // Select policies and join company name
          .eq("client_id", clientId);
        if (policiesError) throw policiesError;
        setPolicies(policiesData as Policy[]);

        // Fetch all companies for the form
        const { data: companiesData, error: companiesError } = await supabase
          .from("companies")
          .select("id, name");
        if (companiesError) throw companiesError;
        setCompanies(companiesData as Company[]);

      } catch (err: any) {
        console.error("Error fetching client details or policies:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [clientId]);

  const handleCreatePolicy = async (policyData: any) => {
    try {
      // Ensure client_id is set for the new policy
      const newPolicyData = { ...policyData, client_id: clientId };
      console.log("ClientDetailsPage: Attempting to create policy with data:", newPolicyData);
      const { data, error } = await supabase.from("policies").insert([newPolicyData]).select("*, companies(name)").single();
      if (error) {
        console.error("ClientDetailsPage: Error inserting policy into Supabase:", error);
        throw error;
      }
      console.log("ClientDetailsPage: Policy created successfully. Data:", data);
      setPolicies((prev) => [...prev, data as Policy]);
      setIsFormOpen(false);
      alert("Póliza creada exitosamente!");
    } catch (err: any) {
      console.error("ClientDetailsPage: Error creating policy:", err);
      alert(`Error al crear la póliza: ${err.message}`);
    }
  };

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

  if (!client) {
    return (
      <AdminLayout>
        <div className="text-center py-8">Cliente no encontrado.</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Client Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center">
              <User className="h-6 w-6 mr-2" />
              {client.nombre}
            </CardTitle>
            <CardDescription>Detalles del Cliente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center">
              <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>{client.email}</span>
            </div>
            {client.telefono && (
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>{client.telefono}</span>
              </div>
            )}
            <div className="flex items-center">
              <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>Documento: {client.documento}</span>
            </div>
            {client.direccion && (
              <div className="flex items-center">
                <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>Dirección: {client.direccion}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Policies Section */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Pólizas Asociadas</h2>
            <p className="text-muted-foreground">Gestiona las pólizas de {client.nombre}</p>
          </div>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button>Crear Nueva Póliza</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Crear Nueva Póliza</DialogTitle>
                <DialogDescription>Ingresa los detalles de la nueva póliza para {client.nombre}.</DialogDescription>
              </DialogHeader>
              <PolicyForm clients={[{ id: client.id, nombre: client.nombre }]} companies={companies} onSubmit={handleCreatePolicy} />
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Listado de Pólizas</CardTitle>
          </CardHeader>
          <CardContent>
            {policies.length === 0 ? (
              <p>No hay pólizas registradas para este cliente.</p>
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
    </AdminLayout>
  );
}