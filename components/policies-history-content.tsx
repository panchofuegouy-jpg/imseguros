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

  // Función de búsqueda mejorada
  const fuzzyMatch = (text: string, search: string): boolean => {
    if (!text) return false;
    
    text = text.toLowerCase();
    search = search.toLowerCase();
    
    // Coincidencia exacta o incluye (más estricto)
    if (text.includes(search)) return true;
    
    // Buscar cada palabra del término de búsqueda
    const searchWords = search.split(/\s+/).filter(w => w.length > 0);
    const textWords = text.split(/\s+/).filter(w => w.length > 0);
    
    // Si todas las palabras de búsqueda están contenidas en alguna palabra del texto
    const allWordsMatch = searchWords.every(searchWord => 
      textWords.some(textWord => textWord.includes(searchWord))
    );
    
    if (allWordsMatch) return true;
    
    // Búsqueda por iniciales solo si son 2-3 letras y sin espacios
    if (search.length >= 2 && search.length <= 3 && !search.includes(' ')) {
      const initials = textWords.map(w => w[0]).join('');
      if (initials === search || initials.startsWith(search)) return true;
    }
    
    return false;
  };

  const filteredPolicies = policies.filter(policy => {
    const trimmedSearch = searchTerm.trim();
    if (trimmedSearch === "") return true;
    
    const searchLower = trimmedSearch.toLowerCase();
    
    return (
      fuzzyMatch(policy.numero_poliza, searchLower) ||
      fuzzyMatch(policy.clients?.nombre || '', searchLower) ||
      (policy.clients?.numero_cliente && policy.clients.numero_cliente.toString().includes(trimmedSearch)) ||
      fuzzyMatch(policy.tipo, searchLower) ||
      fuzzyMatch(policy.companies?.name || '', searchLower) ||
      fuzzyMatch(policy.clients?.email || '', searchLower) ||
      (policy.clients?.telefono && policy.clients.telefono.includes(trimmedSearch)) ||
      fuzzyMatch(policy.notas || '', searchLower) ||
      policy.vigencia_inicio.includes(trimmedSearch) ||
      policy.vigencia_fin.includes(trimmedSearch)
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

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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
                  {paginatedPolicies.map((policy: Policy) => (
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
          
          {/* Controles de paginación */}
          {filteredPolicies.length > itemsPerPage && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredPolicies.length)} de {filteredPolicies.length} pólizas
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <div className="text-sm">
                  Página {currentPage} de {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
