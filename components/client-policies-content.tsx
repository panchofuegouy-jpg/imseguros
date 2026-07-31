"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, FileText, MessageCircle } from "lucide-react";
import { resolvePolicyFileUrl } from "@/lib/policy-file-url";
import { generateWhatsAppPolicyLink } from "@/lib/whatsapp-share";
import { Button } from "@/components/ui/button";

interface ClientPoliciesContentProps {
  initialPolicies: any[];
}

export function ClientPoliciesContent({ initialPolicies }: ClientPoliciesContentProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const fuzzyMatch = (text: string, search: string): boolean => {
    if (!text) return false;

    text = text.toLowerCase();
    search = search.toLowerCase();

    if (text.includes(search)) return true;

    const searchWords = search.split(/\s+/).filter(w => w.length > 0);
    const textWords = text.split(/\s+/).filter(w => w.length > 0);

    const allWordsMatch = searchWords.every(searchWord =>
      textWords.some(textWord => textWord.includes(searchWord))
    );

    if (allWordsMatch) return true;

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
    <div className="space-y-4">
      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar póliza, aseguradora, tipo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-10 text-sm"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Mis Pólizas ({filteredPolicies.length}{filteredPolicies.length !== initialPolicies.length ? ` de ${initialPolicies.length}` : ''})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPolicies.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              {initialPolicies.length === 0 ? "No tienes pólizas registradas." : "No se encontraron pólizas que coincidan con la búsqueda."}
            </p>
          ) : (
            <>
              {/* Mobile View - Cards */}
              <div className="space-y-3 md:hidden">
                {filteredPolicies.map((policy: any) => {
                  const aseguradoNombre = policy.nombre_asegurado || policy.clients?.nombre || 'Sin nombre';
                  return (
                    <div key={policy.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold">Póliza</p>
                          <p className="font-semibold text-sm">{policy.numero_poliza}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground font-semibold">Vence</p>
                          <p className="text-sm font-medium">{policy.vigencia_fin}</p>
                        </div>
                      </div>

                      <div className="pt-1 border-t">
                        <p className="text-xs text-muted-foreground font-semibold mb-1">Asegurado</p>
                        <p className="text-sm">{aseguradoNombre}</p>
                        {policy.parentesco && (
                          <p className="text-xs text-muted-foreground">{policy.parentesco}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold">Aseguradora</p>
                          <p className="truncate">{policy.companies?.name || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold">Tipo</p>
                          <p className="truncate">{policy.tipo}</p>
                        </div>
                      </div>

                      {policy.prima_monto != null && (
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground font-semibold">Prima</p>
                          <p className="font-medium">
                            {policy.moneda || 'UYU'} {Number(policy.prima_monto).toLocaleString('es-UY', { minimumFractionDigits: 2 })}
                            {policy.forma_pago && <span className="text-xs text-muted-foreground ml-1">/ {policy.forma_pago}</span>}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2 pt-1 border-t flex-wrap">
                        {policy.archivo_urls && Array.isArray(policy.archivo_urls) && policy.archivo_urls.length > 0 &&
                          policy.archivo_urls.map((url: string, index: number) => (
                            <a
                              key={index}
                              href={resolvePolicyFileUrl(url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline bg-primary/10 px-2 py-1 rounded"
                            >
                              <FileText className="h-3 w-3" />
                              Archivo {index + 1}
                            </a>
                          ))
                        }
                        {policy.clients?.telefono && (() => {
                          const waLink = generateWhatsAppPolicyLink(
                            policy.clients.telefono,
                            aseguradoNombre,
                            policy.numero_poliza,
                            policy.tipo,
                            policy.vigencia_fin,
                            policy.id
                          );
                          return waLink ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-green-600 hover:underline bg-green-500/10 px-2 py-1 rounded"
                            >
                              <MessageCircle className="h-3 w-3" />
                              WhatsApp
                            </a>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop View - Table */}
              <div className="hidden md:block overflow-x-auto rounded-md border">
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[12%]">Póliza</TableHead>
                      <TableHead className="w-[20%]">Asegurado</TableHead>
                      <TableHead className="w-[15%]">Aseguradora</TableHead>
                      <TableHead className="w-[12%]">Tipo</TableHead>
                      <TableHead className="w-[13%]">Prima</TableHead>
                      <TableHead className="w-[10%]">Inicio</TableHead>
                      <TableHead className="w-[10%]">Fin</TableHead>
                      <TableHead className="w-[8%] text-center">Doc</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPolicies.map((policy: any) => {
                      const aseguradoNombre = policy.nombre_asegurado || policy.clients?.nombre || 'Sin nombre';
                      return (
                        <TableRow key={policy.id}>
                          <TableCell className="font-semibold truncate">{policy.numero_poliza}</TableCell>
                          <TableCell>
                            <div className="truncate">
                              <p className="font-medium truncate">{aseguradoNombre}</p>
                              {policy.parentesco && (
                                <p className="text-xs text-muted-foreground truncate">{policy.parentesco}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="truncate">{policy.companies?.name || "N/A"}</TableCell>
                          <TableCell className="truncate">{policy.tipo}</TableCell>
                          <TableCell className="truncate">
                            {policy.prima_monto != null ? (
                              <span className="font-medium">
                                {policy.moneda || 'UYU'} {Number(policy.prima_monto).toLocaleString('es-UY', { minimumFractionDigits: 0 })}
                              </span>
                            ) : 'N/A'}
                          </TableCell>
                          <TableCell className="truncate text-center">{policy.vigencia_inicio}</TableCell>
                          <TableCell className="truncate text-center">{policy.vigencia_fin}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {policy.archivo_urls && Array.isArray(policy.archivo_urls) && policy.archivo_urls.length > 0 ? (
                                <a
                                  href={resolvePolicyFileUrl(policy.archivo_urls[0])}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center text-primary hover:underline"
                                  title={`${policy.archivo_urls.length} archivo(s)`}
                                >
                                  <FileText className="h-4 w-4" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                              {policy.clients?.telefono && (() => {
                                const waLink = generateWhatsAppPolicyLink(
                                  policy.clients.telefono,
                                  aseguradoNombre,
                                  policy.numero_poliza,
                                  policy.tipo,
                                  policy.vigencia_fin,
                                  policy.archivo_urls?.[0] ? resolvePolicyFileUrl(policy.archivo_urls[0]) : undefined
                                );
                                return waLink ? (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center text-green-600 hover:text-green-700"
                                    title="Compartir por WhatsApp"
                                  >
                                    <MessageCircle className="h-4 w-4" />
                                  </a>
                                ) : null;
                              })()}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
