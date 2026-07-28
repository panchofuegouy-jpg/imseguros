"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { resolvePolicyFileUrl } from "@/lib/policy-file-url";

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

const formatPolicyDate = (dateString: string) => {
  const [year, month, day] = dateString.split("T")[0].split("-");
  return year && month && day ? `${day}/${month}/${year}` : dateString;
};

export function PoliciesHistoryContent({ initialPolicies }: PoliciesHistoryContentProps) {
  const [policies] = useState<Policy[]>(initialPolicies);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [topbarActionsContainer, setTopbarActionsContainer] = useState<HTMLElement | null>(null);
  const itemsPerPage = 50;

  useEffect(() => {
    setTopbarActionsContainer(document.getElementById("admin-topbar-actions"));
  }, []);

  const fuzzyMatch = (text: string, search: string): boolean => {
    if (!text) return false;

    const normalizedText = text.toLowerCase();
    const normalizedSearch = search.toLowerCase();
    if (normalizedText.includes(normalizedSearch)) return true;

    const searchWords = normalizedSearch.split(/\s+/).filter(Boolean);
    const textWords = normalizedText.split(/\s+/).filter(Boolean);
    if (searchWords.every((searchWord) => textWords.some((textWord) => textWord.includes(searchWord)))) {
      return true;
    }

    if (normalizedSearch.length >= 2 && normalizedSearch.length <= 3 && !normalizedSearch.includes(" ")) {
      const initials = textWords.map((word) => word[0]).join("");
      return initials === normalizedSearch || initials.startsWith(normalizedSearch);
    }

    return false;
  };

  const filteredPolicies = policies.filter((policy) => {
    const search = searchTerm.trim();
    if (!search) return true;

    return (
      fuzzyMatch(policy.numero_poliza, search) ||
      fuzzyMatch(policy.clients?.nombre || "", search) ||
      Boolean(policy.clients?.numero_cliente?.toString().includes(search)) ||
      fuzzyMatch(policy.tipo, search) ||
      fuzzyMatch(policy.companies?.name || "", search) ||
      fuzzyMatch(policy.clients?.email || "", search) ||
      Boolean(policy.clients?.telefono?.includes(search)) ||
      fuzzyMatch(policy.notas || "", search) ||
      policy.vigencia_inicio.includes(search) ||
      policy.vigencia_fin.includes(search)
    );
  });

  const totalPages = Math.ceil(filteredPolicies.length / itemsPerPage);
  const paginatedPolicies = filteredPolicies.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleRefresh = () => {
    setRefreshing(true);
    window.location.reload();
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <div className="space-y-4">
      {topbarActionsContainer &&
        createPortal(
          <div className="flex h-14 w-full items-center justify-end">
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
              className="font-semibold uppercase"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>,
          topbarActionsContainer,
        )}

      <Card className="gap-0 py-3">
        <CardContent className="px-3 sm:px-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="BUSCAR POR PÓLIZA, CLIENTE, ASEGURADORA, TELÉFONO O EMAIL..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value.toUpperCase())}
              className="h-14 rounded-xl pl-12 text-base font-semibold uppercase placeholder:text-sm sm:text-lg sm:placeholder:text-base"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="gap-4 py-4 uppercase">
        <CardHeader className="px-4">
          <CardTitle className="text-sm font-bold">
            Pólizas ({filteredPolicies.length}
            {filteredPolicies.length !== policies.length ? ` de ${policies.length}` : ""})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-4">
          {filteredPolicies.length === 0 ? (
            <div className="py-8 text-center text-sm">
              {policies.length === 0
                ? "NO HAY PÓLIZAS REGISTRADAS EN EL SISTEMA."
                : "NO SE ENCONTRARON PÓLIZAS QUE COINCIDAN CON LA BÚSQUEDA."}
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-border/70">
              <Table className="table-fixed text-xs">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[11%] px-2 text-center text-[11px]">Póliza</TableHead>
                    <TableHead className="w-[28%] border-l border-dashed border-border px-2 text-[11px]">Cliente</TableHead>
                    <TableHead className="w-[10%] border-l border-dashed border-border px-2 text-center text-[11px]">Aseguradora</TableHead>
                    <TableHead className="w-[12%] border-l border-dashed border-border px-2 text-center text-[11px]">Tipo</TableHead>
                    <TableHead className="w-[11%] border-l border-dashed border-border px-2 text-center text-[11px]">Inicio</TableHead>
                    <TableHead className="w-[11%] border-l border-dashed border-border px-2 text-center text-[11px]">Fin</TableHead>
                    <TableHead className="w-[9%] border-l border-dashed border-border px-2 text-center text-[11px]">Documento</TableHead>
                    <TableHead className="w-[8%] border-l border-dashed border-border px-2 text-center text-[11px]">Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPolicies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell className="truncate px-2 text-center font-bold">
                        {policy.numero_poliza}
                      </TableCell>
                      <TableCell className="border-l border-dashed border-border px-2">
                        <Link
                          href={`/admin/clientes/${policy.client_id}`}
                          className="block truncate font-semibold text-foreground hover:text-primary hover:underline"
                          title={policy.clients?.nombre || "N/A"}
                        >
                          {policy.clients?.nombre || "N/A"}
                        </Link>
                      </TableCell>
                      <TableCell className="border-l border-dashed border-border px-1 text-center">
                        <span className="inline-flex max-w-full truncate rounded-md border border-border/80 bg-muted/40 px-2 py-1 font-semibold">
                          {policy.companies?.name || "N/A"}
                        </span>
                      </TableCell>
                      <TableCell className="border-l border-dashed border-border px-1 text-center">
                        <span
                          className="inline-flex max-w-full truncate rounded-md border border-border/80 bg-muted/40 px-2 py-1 font-semibold"
                          title={policy.tipo}
                        >
                          {policy.tipo}
                        </span>
                      </TableCell>
                      <TableCell className="border-l border-dashed border-border px-1 text-center">
                        <span className="inline-flex rounded-md border border-border/80 bg-muted/40 px-1.5 py-1 font-semibold">
                          {formatPolicyDate(policy.vigencia_inicio)}
                        </span>
                      </TableCell>
                      <TableCell className="border-l border-dashed border-border px-1 text-center">
                        <span className="inline-flex rounded-md border border-border/80 bg-muted/40 px-1.5 py-1 font-semibold">
                          {formatPolicyDate(policy.vigencia_fin)}
                        </span>
                      </TableCell>
                      <TableCell className="border-l border-dashed border-border px-1 text-center">
                        {policy.archivo_urls?.length ? (
                          <a
                            href={resolvePolicyFileUrl(policy.archivo_urls[0])}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-primary/50 bg-primary/15 px-2 py-1 font-semibold text-foreground hover:bg-primary/25"
                            title={`ABRIR DOCUMENTO${policy.archivo_urls.length > 1 ? ` (+${policy.archivo_urls.length - 1})` : ""}`}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {policy.archivo_urls.length > 1 ? `+${policy.archivo_urls.length - 1}` : "VER"}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="border-l border-dashed border-border px-2 text-center">
                        <span className="block truncate text-muted-foreground" title={policy.notas || "SIN NOTAS"}>
                          {policy.notas || "N/A"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredPolicies.length > itemsPerPage && (
            <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4">
              <div className="text-xs text-muted-foreground">
                {(currentPage - 1) * itemsPerPage + 1}–
                {Math.min(currentPage * itemsPerPage, filteredPolicies.length)} DE {filteredPolicies.length}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
                  disabled={currentPage === 1}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-semibold">{currentPage} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((previous) => Math.min(totalPages, previous + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Página siguiente"
                >
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
