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

  const filteredPolicies = initialPolicies.filter(policy => {
    const trimmedSearch = searchTerm.trim();
    if (trimmedSearch === "") return true;
    
    const searchLower = trimmedSearch.toLowerCase();
    
    const aseguradoNombre = policy.nombre_asegurado || policy.clients?.nombre || '';
    
    return (
      fuzzyMatch(policy.numero_poliza, searchLower) ||
      fuzzyMatch(aseguradoNombre, searchLower) ||
      fuzzyMatch(policy.companies?.name || '', searchLower) ||
      fuzzyMatch(policy.tipo, searchLower) ||
      fuzzyMatch(policy.parentesco || '', searchLower) ||
      fuzzyMatch(policy.notas || '', searchLower) ||
      policy.vigencia_inicio.includes(trimmedSearch) ||
      policy.vigencia_fin.includes(trimmedSearch)
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
