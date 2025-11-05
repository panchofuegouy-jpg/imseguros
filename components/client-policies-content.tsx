"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface ClientPoliciesContentProps {
  initialPolicies: any[];
}

export function ClientPoliciesContent({ initialPolicies }: ClientPoliciesContentProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredPolicies = initialPolicies.filter(policy => {
    if (searchTerm.trim() === "") return true;
    
    const searchLower = searchTerm.toLowerCase();
    const searchTerm_trim = searchTerm.trim();
    
    const aseguradoNombre = policy.nombre_asegurado || policy.clients?.nombre || '';
    
    return (
      policy.numero_poliza.toLowerCase().includes(searchLower) ||
      aseguradoNombre.toLowerCase().includes(searchLower) ||
      (policy.companies?.name && policy.companies.name.toLowerCase().includes(searchLower)) ||
      policy.tipo.toLowerCase().includes(searchLower) ||
      (policy.parentesco && policy.parentesco.toLowerCase().includes(searchLower)) ||
      (policy.notas && policy.notas.toLowerCase().includes(searchLower)) ||
      policy.vigencia_inicio.includes(searchTerm_trim) ||
      policy.vigencia_fin.includes(searchTerm_trim)
    );
  });

  return (
    <div className="space-y-6">
      {/* Search Filter */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número de póliza, aseguradora, tipo, notas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Mis Pólizas ({filteredPolicies.length}{filteredPolicies.length !== initialPolicies.length ? ` de ${initialPolicies.length}` : ''})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPolicies.length === 0 ? (
            <p>{initialPolicies.length === 0 ? "No tienes pólizas registradas." : "No se encontraron pólizas que coincidan con la búsqueda."}</p>
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
                {filteredPolicies.map((policy: any) => {
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
                            {policy.archivo_urls.map((url: string, index: number) => (
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
                      <TableCell>{policy.notas || "N/A"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
