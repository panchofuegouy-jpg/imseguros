"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Policy {
  id: string;
  numero_poliza: string;
  client_id: string;
  tipo: string;
  vigencia_inicio: string;
  vigencia_fin: string;
  archivo_urls?: string[];
  notas: string | null;
  created_at: string;
  clients: {
    nombre: string;
    numero_cliente: number | null;
    email?: string;
    telefono?: string | null;
  } | null;
  companies: {
    name: string;
  } | null;
}

interface PoliciesHistoryContentProps {
  initialPolicies: Policy[];
}

export function PoliciesHistoryContent({ initialPolicies }: PoliciesHistoryContentProps) {
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const filteredPolicies = policies.filter(policy => {
    if (searchTerm.trim() === "") return true;
    
    const searchLower = searchTerm.toLowerCase();
    const searchTerm_trim = searchTerm.trim();
    
    return (
      policy.numero_poliza.toLowerCase().includes(searchLower) ||
      (policy.clients?.nombre && policy.clients.nombre.toLowerCase().includes(searchLower)) ||
      (policy.clients?.numero_cliente && policy.clients.numero_cliente.toString().includes(searchTerm_trim)) ||
      policy.tipo.toLowerCase().includes(searchLower) ||
      (policy.companies?.name && policy.companies.name.toLowerCase().includes(searchLower)) ||
      (policy.clients?.email && policy.clients.email.toLowerCase().includes(searchLower)) ||
      (policy.clients?.telefono && policy.clients.telefono.includes(searchTerm_trim)) ||
      (policy.notas && policy.notas.toLowerCase().includes(searchLower)) ||
      policy.vigencia_inicio.includes(searchTerm_trim) ||
      policy.vigencia_fin.includes(searchTerm_trim)
    );
  });

  const totalPages = Math.ceil(filteredPolicies.length / itemsPerPage);
  const paginatedPolicies = filteredPolicies.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Refrescar datos
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Simular recarga - en una implementación real podrías hacer fetch
      window.location.reload();
    } catch (error) {
      console.error("Error refreshing policies:", error);
    }
  };

  // Limpiar filtros
  const clearFilters = () => {
    setSearchTerm("");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Historial de Pólizas</h1>
          <p className="text-muted-foreground">Todas las pólizas registradas en el sistema.</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <div className="flex items-center space-x-2 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número de póliza, cliente, aseguradora, teléfono, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Tabla de pólizas */}
      <Card>
        <CardHeader>
          <CardTitle>
            Listado Completo de Pólizas ({filteredPolicies.length}{filteredPolicies.length !== policies.length ? ` de ${policies.length}` : ''})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPolicies.length === 0 ? (
            <div className="text-center py-8">
              {policies.length === 0 
                ? "No hay pólizas registradas en el sistema." 
                : "No se encontraron pólizas que coincidan con la búsqueda."}
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                  {filteredPolicies.map((policy: Policy) => (
                    <TableRow key={policy.id}>
                      <TableCell className="font-medium">
                        {policy.numero_poliza}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <Link 
                            href={`/admin/clientes/${policy.client_id}`} 
                            className="text-blue-600 hover:underline font-medium"
                          >
                            {policy.clients?.nombre || "N/A"}
                          </Link>
                          {policy.clients?.numero_cliente && (
                            <span className="text-xs text-muted-foreground">
                              #{policy.clients.numero_cliente}
                            </span>
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
                            {policy.archivo_urls.slice(0, 1).map((url, index) => (
                              <a
                                key={index}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-sm"
                              >
                                Archivo {index + 1}
                              </a>
                            ))}
                            {policy.archivo_urls.length > 1 && (
                              <span className="text-xs text-muted-foreground">
                                +{policy.archivo_urls.length - 1} más
                              </span>
                            )}
                          </div>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                      <TableCell>
                        {policy.notas ? (
                          <div className="max-w-xs">
                            <p className="text-sm truncate" title={policy.notas}>
                              {policy.notas}
                            </p>
                          </div>
                        ) : (
                          "N/A"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
