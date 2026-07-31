"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PolicyForm from "@/components/policy-form";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw, Edit, CheckCircle, AlertCircle, Clock, XCircle, Phone, MessageCircle, Upload, FileText, X, User, Wand2, ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { normalizeOcrDate } from "@/lib/ocr-date";
import {
  POLICY_TYPE_OPTIONS,
  PAYMENT_FREQUENCY_OPTIONS,
  isSameName,
  matchCompanyId,
  matchCurrency,
  matchPaymentFrequency,
  matchPolicyType,
  pickOcrAmount,
} from "@/lib/ocr-normalize";

interface Policy {
  id: string;
  numero_poliza: string;
  tipo: string;
  vigencia_inicio: string;
  vigencia_fin: string;
  notas?: string;
  archivo_urls?: string[];
  status: string;
  client_id: string;
  company_id: string;
  nombre_asegurado?: string;
  documento_asegurado?: string;
  parentesco?: string;
  prima_monto?: number;
  moneda?: string;
  forma_pago?: string;
  numero_factura?: string;
  clients: {
    id: string;
    nombre: string;
    email?: string;
    telefono?: string;
  };
  companies: {
    id: string;
    name: string;
  };
}

interface Company {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: 'Pendiente', label: 'Pendiente', color: 'bg-gray-500', activeTab: 'pending' },
  { value: 'Contactado', label: 'Contactado', color: 'bg-primary', activeTab: 'pending' },
  { value: 'En Proceso', label: 'En Proceso', color: 'bg-yellow-500', activeTab: 'pending' },
  { value: 'Renovada', label: 'Renovada', color: 'bg-green-500', activeTab: 'history' },
  { value: 'No Renovada', label: 'No Renovada', color: 'bg-red-500', activeTab: 'pending' },
];

// El filtro tiene que ofrecer los mismos tipos con los que se guardan las
// pólizas: filtrar por un valor que nadie guarda nunca devuelve una lista vacía.
const POLICY_TYPES = POLICY_TYPE_OPTIONS;

export function PoliciesNearExpirationContent() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  
  // Filtros
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Dialogo de renovación
  const [renewalDialogOpen, setRenewalDialogOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [topbarActionsContainer, setTopbarActionsContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTopbarActionsContainer(document.getElementById("admin-topbar-actions"));
  }, []);

  // Cargar compañías
  const fetchCompanies = async () => {
    try {
      const response = await fetch('/api/companies');
      if (response.ok) {
        const data = await response.json();
        setCompanies(data);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  // Cargar pólizas
  const fetchPolicies = async () => {
    const params = new URLSearchParams();
    if (selectedMonth && selectedMonth !== 'all') params.append('month', selectedMonth);
    if (selectedCompany && selectedCompany !== 'all') params.append('company', selectedCompany);
    if (selectedType && selectedType !== 'all') params.append('type', selectedType);
    
    // Si estamos en tab de historial, mostrar solo renovadas
    // Si estamos en tab de pendientes, el backend ya excluye las renovadas
    if (activeTab === 'history') {
      params.append('status', 'Renovada');
    } else if (selectedStatus && selectedStatus !== 'all') {
      params.append('status', selectedStatus);
    }

    try {
      const response = await fetch(`/api/policies/near-expiration?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setPolicies(data);
      } else {
        toast.error("No se pudieron cargar las pólizas.");
      }
    } catch (error) {
      console.error('Error loading policies:', error);
      toast.error("Error de conexión al cargar las pólizas.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Actualizar estado de una póliza
  const updatePolicyStatus = async (policyId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/policies/${policyId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        toast.success(`Estado actualizado a "${newStatus}".`);
        fetchPolicies(); // Recargar la lista
      } else {
        throw new Error('Error al actualizar');
      }
    } catch (error) {
      toast.error("No se pudo actualizar el estado de la póliza.");
    }
  };

  // Manejar renovación de póliza
  const handleRenewal = (policy: Policy) => {
    setSelectedPolicy(policy);
    setRenewalDialogOpen(true);
  };

  // Generar link de WhatsApp con mensaje pre-escrito
  const getWhatsAppLink = (policy: Policy) => {
    const digits = policy.clients.telefono?.replace(/\D/g, "");
    if (!digits) return null;
    // Normalizar: quitar 0 inicial y agregar código de país Uruguay (+598)
    const local = digits.startsWith("598") ? digits : digits.startsWith("0") ? "598" + digits.slice(1) : "598" + digits;
    const phone = local;
    const daysLeft = getDaysUntilExpiration(policy.vigencia_fin);
    const expirationFormatted = formatDate(policy.vigencia_fin);
    const daysText = daysLeft > 0 ? `vence en ${daysLeft} días (${expirationFormatted})` : `venció el ${expirationFormatted}`;
    const message = `Estimado/a ${policy.clients.nombre}, le informamos que su póliza N° ${policy.numero_poliza} (${policy.tipo} - ${policy.companies.name}) ${daysText}. Por favor contáctenos para proceder con la renovación. Gracias, IM Seguros.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  // Manejar éxito de renovación
  const handleRenewalSuccess = () => {
    setRenewalDialogOpen(false);
    setSelectedPolicy(null);
    fetchPolicies();
    toast.success("Póliza renovada exitosamente.");
  };

  // Refrescar datos
  const handleRefresh = () => {
    setRefreshing(true);
    fetchPolicies();
  };

  // Limpiar filtros
  const clearFilters = () => {
    setSelectedMonth("all");
    setSelectedCompany("all");
    setSelectedType("all");
    setSelectedStatus("all");
    setClientSearchTerm("");
    setActiveTab('pending');
  };
  
  // Cambiar tab
  const handleTabChange = async (tab: 'pending' | 'history') => {
    setActiveTab(tab);
    setSelectedStatus('all');
    setSelectedMonth('all');
    setLoading(true);
    
    // Recargar datos del tab
    const params = new URLSearchParams();
    if (selectedCompany && selectedCompany !== 'all') params.append('company', selectedCompany);
    if (selectedType && selectedType !== 'all') params.append('type', selectedType);
    
    if (tab === 'history') {
      params.append('status', 'Renovada');
    }
    
    try {
      const response = await fetch(`/api/policies/near-expiration?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setPolicies(data);
      }
    } catch (error) {
      console.error('Error loading policies:', error);
      toast.error("Error al cargar las pólizas.");
    } finally {
      setLoading(false);
    }
  };

  // Filtrar pólizas por cliente, aseguradora, póliza, notas, tipo, teléfono, etc localmente
  const filteredPolicies = policies.filter(policy => {
    if (clientSearchTerm.trim() === "") return true;
    
    const searchLower = clientSearchTerm.toLowerCase();
    const searchTerm_trim = clientSearchTerm.trim();
    
    return (
      // Búsqueda en nombre del cliente
      policy.clients.nombre.toLowerCase().includes(searchLower) ||
      // Búsqueda en email del cliente
      (policy.clients.email && policy.clients.email.toLowerCase().includes(searchLower)) ||
      // Búsqueda en teléfono del cliente
      (policy.clients.telefono && policy.clients.telefono.includes(searchTerm_trim)) ||
      // Búsqueda en número de póliza
      policy.numero_poliza.toLowerCase().includes(searchLower) ||
      // Búsqueda en aseguradora
      policy.companies.name.toLowerCase().includes(searchLower) ||
      // Búsqueda en tipo de póliza
      policy.tipo.toLowerCase().includes(searchLower) ||
      // Búsqueda en notas
      (policy.notas && policy.notas.toLowerCase().includes(searchLower)) ||
      // Búsqueda en fechas
      policy.vigencia_inicio.includes(searchTerm_trim) ||
      policy.vigencia_fin.includes(searchTerm_trim)
    );
  });

  // Efectos
  useEffect(() => {
    fetchCompanies();
    fetchPolicies();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchPolicies();
    }
  }, [selectedMonth, selectedCompany, selectedType, selectedStatus, activeTab]);

  // Generar opciones de meses
  const generateMonthOptions = () => {
    const months = [];
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
      months.push({ value, label });
    }
    
    return months;
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'numeric',
    });
  };

  // Calcular días hasta vencimiento
  const getDaysUntilExpiration = (expirationDate: string) => {
    const today = new Date();
    const expDate = new Date(expirationDate);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-6">
      {topbarActionsContainer && createPortal(
        <div className="flex h-14 w-full min-w-0 items-center justify-between gap-3">
          <div className="flex h-full min-w-0 items-stretch gap-1">
            <button
              onClick={() => handleTabChange('pending')}
              className={`truncate border-b-2 px-3 text-xs font-medium uppercase transition-colors sm:px-4 sm:text-sm ${
                activeTab === 'pending'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Pendientes de Renovación
            </button>
            <button
              onClick={() => handleTabChange('history')}
              className={`truncate border-b-2 px-3 text-xs font-medium uppercase transition-colors sm:px-4 sm:text-sm ${
                activeTab === 'history'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Historial de Renovadas
            </button>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            size="sm"
            className="shrink-0 uppercase"
          >
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
        </div>,
        topbarActionsContainer,
      )}

      {/* Filtros */}
      <Card className="gap-0 py-4">
        <CardContent className="px-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="BUSCAR POR CLIENTE, ASEGURADORA, PÓLIZA, TELÉFONO O EMAIL..."
                value={clientSearchTerm}
                onChange={(e) => setClientSearchTerm(e.target.value.toUpperCase())}
                className="h-14 w-full rounded-xl pl-12 pr-4 text-lg font-semibold uppercase tracking-wide placeholder:text-sm placeholder:font-medium placeholder:tracking-normal sm:placeholder:text-base"
              />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
                aria-expanded={filtersOpen}
                title={filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
                onClick={() => setFiltersOpen((open) => !open)}
                className={`h-14 w-14 shrink-0 rounded-xl transition-colors ${
                  filtersOpen ? "border-primary bg-primary/15 text-primary" : ""
                }`}
              >
                <SlidersHorizontal className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Otros filtros */}
            {filtersOpen && (
            <div className="animate-in fade-in-0 slide-in-from-top-2 border-t border-border/70 pt-3 uppercase duration-200">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Filtros avanzados
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 uppercase"
                >
                  Limpiar filtros
                </Button>
              </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {activeTab === 'pending' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Mes de Vencimiento</label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los meses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Próximos 60 días</SelectItem>
                    {generateMonthOptions().map(month => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">Aseguradora</label>
                <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las aseguradoras" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {companies.map(company => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Tipo de Póliza</label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {POLICY_TYPES.map(type => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {activeTab === 'pending' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Estado</label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los estados" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {STATUS_OPTIONS.filter(s => s.activeTab === 'pending').map(status => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabla de pólizas */}
      <Card className="gap-4 uppercase">
        <CardHeader className="px-4">
          <CardTitle className="text-sm">
            {activeTab === 'pending' 
              ? `Pólizas por Vencer (${filteredPolicies.length}${filteredPolicies.length !== policies.length ? ` de ${policies.length}` : ''})` 
              : `Pólizas Renovadas (${filteredPolicies.length}${filteredPolicies.length !== policies.length ? ` de ${policies.length}` : ''})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-4">
          {loading ? (
            <div className="text-center py-8">Cargando pólizas...</div>
          ) : filteredPolicies.length === 0 ? (
            <div className="text-center py-8">
              {policies.length === 0 
                ? "No hay pólizas que coincidan con los filtros seleccionados." 
                : "No se encontraron pólizas con ese cliente."}
            </div>
          ) : (
            <>
              {/* Mobile View - Cards */}
              <div className="space-y-2 md:hidden">
                {filteredPolicies.map((policy) => {
                  const daysUntilExpiration = getDaysUntilExpiration(policy.vigencia_fin);
                  const isUrgent = daysUntilExpiration <= 7;
                  const isExpired = daysUntilExpiration <= 0;
                  const currentStatus = STATUS_OPTIONS.find((status) => status.value === policy.status);

                  return (
                    <div key={policy.id} className={`rounded-lg border p-3 space-y-2 ${isExpired ? "bg-red-500/10 border-red-500/30" : isUrgent ? "bg-red-500/10 border-red-500/30" : ""}`}>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground font-semibold">Póliza</p>
                          <p className="font-bold text-sm">{policy.numero_poliza}</p>
                        </div>
                        <div className={`inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs font-semibold ${
                          isUrgent
                            ? 'border-red-500/40 bg-red-500/10 text-red-400'
                            : daysUntilExpiration <= 15
                              ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400'
                              : 'border-primary/40 bg-primary/10 text-primary'
                        }`}>
                          {daysUntilExpiration > 0
                            ? `${daysUntilExpiration}d`
                            : `Vencida`
                          }
                        </div>
                      </div>

                      <div className="pt-1 border-t">
                        <p className="text-xs text-muted-foreground font-semibold mb-1">Cliente</p>
                        <Link
                          href={`/admin/clientes/${policy.client_id}`}
                          className="font-semibold text-primary hover:underline text-sm truncate block"
                        >
                          {policy.clients.nombre}
                        </Link>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground font-semibold mb-1">Aseguradora</p>
                          <p className="truncate">{policy.companies.name}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground font-semibold mb-1">Tipo</p>
                          <p className="truncate">{policy.tipo}</p>
                        </div>
                      </div>

                      <div className="flex gap-1 pt-1 border-t flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRenewal(policy)}
                          className="flex-1 h-8 text-xs"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Renovar
                        </Button>

                        {policy.clients.telefono && (() => {
                          const waLink = getWhatsAppLink(policy);
                          return waLink ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(waLink, '_blank')}
                              className="h-8 w-8 p-0"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          ) : null;
                        })()}

                        {policy.clients.telefono && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`tel:${policy.clients.telefono}`, '_self')}
                            className="h-8 w-8 p-0"
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-8 justify-between gap-1 px-2 text-xs"
                          >
                            <span className="flex items-center gap-1.5">
                              <span className={`h-2 w-2 rounded-full ${currentStatus?.color || "bg-gray-500"}`} />
                              <span className="truncate text-xs">{policy.status}</span>
                            </span>
                            <ChevronDown className="h-3 w-3 shrink-0" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {STATUS_OPTIONS.map((status) => (
                            <DropdownMenuItem
                              key={status.value}
                              onClick={() => updatePolicyStatus(policy.id, status.value)}
                              className="cursor-pointer text-xs"
                              disabled={policy.status === status.value}
                            >
                              <span className={`mr-2 h-2 w-2 rounded-full ${status.color}`} />
                              {status.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>

              {/* Desktop View - Table */}
              <div className="hidden md:block overflow-hidden">
                <Table className="text-xs uppercase">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[9%] text-center">Vence</TableHead>
                      <TableHead className="w-[11%]">Póliza</TableHead>
                      <TableHead className="w-[25%]">Cliente</TableHead>
                      <TableHead className="w-[10%] text-center">Aseguradora</TableHead>
                      <TableHead className="w-[10%] text-center">Tipo</TableHead>
                      <TableHead className="w-[8%] text-center">Fecha</TableHead>
                      <TableHead className="w-[13%] text-center">Acciones</TableHead>
                      <TableHead className="w-[14%] text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPolicies.map((policy) => {
                      const daysUntilExpiration = getDaysUntilExpiration(policy.vigencia_fin);
                      const isUrgent = daysUntilExpiration <= 7;
                      const isExpired = daysUntilExpiration <= 0;
                      const currentStatus = STATUS_OPTIONS.find((status) => status.value === policy.status);

                      return (
                        <TableRow key={policy.id} className={isExpired || isUrgent ? "bg-red-500/10" : ""}>
                          <TableCell className="text-center">
                            <span className={`inline-flex items-center justify-center rounded-md border px-2 py-1 font-semibold text-xs ${
                              isUrgent
                                ? 'border-red-500/40 bg-red-500/10 text-red-400'
                                : daysUntilExpiration <= 15
                                  ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400'
                                  : 'border-primary/40 bg-primary/10 text-primary'
                            }`}>
                              {daysUntilExpiration > 0
                                ? `${daysUntilExpiration}d`
                                : `Vencida`
                              }
                            </span>
                          </TableCell>
                          <TableCell className="truncate font-semibold">{policy.numero_poliza}</TableCell>
                          <TableCell>
                            <Link
                              href={`/admin/clientes/${policy.client_id}`}
                              className="truncate font-medium text-primary hover:underline block"
                            >
                              {policy.clients.nombre}
                            </Link>
                          </TableCell>
                          <TableCell className="text-center truncate">{policy.companies.name}</TableCell>
                          <TableCell className="text-center truncate">{policy.tipo}</TableCell>
                          <TableCell className="text-center">{formatShortDate(policy.vigencia_fin)}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRenewal(policy)}
                                className="h-7 px-2 text-xs"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>

                              {policy.clients.telefono && (() => {
                                const waLink = getWhatsAppLink(policy);
                                return waLink ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(waLink, '_blank')}
                                    className="h-7 w-7 p-0"
                                  >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                  </Button>
                                ) : null;
                              })()}

                              {policy.clients.telefono && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(`tel:${policy.clients.telefono}`, '_self')}
                                  className="h-7 w-7 p-0"
                                >
                                  <Phone className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-full justify-between gap-1 px-2 text-xs"
                                >
                                  <span className="flex items-center gap-1">
                                    <span className={`h-2 w-2 rounded-full ${currentStatus?.color || "bg-gray-500"}`} />
                                    <span className="truncate text-xs">{policy.status}</span>
                                  </span>
                                  <ChevronDown className="h-3 w-3 shrink-0" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40 text-xs">
                                {STATUS_OPTIONS.map((status) => (
                                  <DropdownMenuItem
                                    key={status.value}
                                    onClick={() => updatePolicyStatus(policy.id, status.value)}
                                    className="cursor-pointer text-xs"
                                    disabled={policy.status === status.value}
                                  >
                                    <span className={`mr-2 h-2 w-2 rounded-full ${status.color}`} />
                                    {status.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
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

      {/* Dialog de renovación */}
      <Dialog open={renewalDialogOpen} onOpenChange={setRenewalDialogOpen}>
        <DialogContent
          overlayClassName="bg-black/85 backdrop-blur-[2px]"
          className="h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-white/10 bg-[#121A1B] p-0! shadow-2xl shadow-black/60"
          style={{
            maxWidth: "min(72rem, calc(100vw - 3rem))",
            overflow: "hidden",
            padding: 0,
            backgroundColor: "#121A1B",
          }}
        >
          <DialogHeader className="border-b border-white/10 px-6 py-5 pr-14">
            <DialogTitle>
              Renovar Póliza: {selectedPolicy?.numero_poliza}
            </DialogTitle>
          </DialogHeader>
          {selectedPolicy && (
            <RenewalForm
              policy={selectedPolicy}
              companies={companies}
              onSuccess={handleRenewalSuccess}
              onCancel={() => setRenewalDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Formulario completo de renovación
function RenewalForm({ policy, companies, onSuccess, onCancel }: {
  policy: Policy;
  companies: Company[];
  onSuccess: () => void;
  onCancel: () => void;
}) {

  const [formData, setFormData] = useState({
    numero_poliza: policy.numero_poliza,
    company_id: policy.company_id || "",
    tipo: policy.tipo || "",
    vigencia_inicio: policy.vigencia_inicio,
    vigencia_fin: policy.vigencia_fin,
    nombre_asegurado: policy.nombre_asegurado || "",
    documento_asegurado: policy.documento_asegurado || "",
    parentesco: policy.parentesco || "Titular",
    prima_monto: policy.prima_monto?.toString() || "",
    moneda: policy.moneda || "UYU",
    forma_pago: policy.forma_pago || "",
    numero_factura: policy.numero_factura || "",
    notas: policy.notas || "",
  });

  const [useClientAsInsured, setUseClientAsInsured] = useState(
    !policy.nombre_asegurado || policy.nombre_asegurado === ""
  );

  const [fileAttachments, setFileAttachments] = useState<Array<{
    id: string; file?: File; url?: string; name: string; size?: number; isExisting?: boolean;
  }>>(() => {
    if (policy.archivo_urls && Array.isArray(policy.archivo_urls)) {
      return policy.archivo_urls.map((url: string, index: number) => ({
        id: `existing-${index}`, url, name: `Archivo ${index + 1}`, isExisting: true,
      }));
    }
    return [];
  });

  const [loading, setLoading] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrFile, setOcrFile] = useState<File | null>(null);

  const formatFileSize = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const allowed = ["application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

    selectedFiles.forEach(file => {
      if (allowed.includes(file.type)) {
        setFileAttachments(prev => [...prev, {
          id: `new-${Date.now()}-${Math.random()}`, file, name: file.name, size: file.size,
        }]);
      } else {
        toast.error(`${file.name} no es válido. Solo PDF, DOC o DOCX`);
      }
    });
    event.target.value = '';
  };

  const handleOcrFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setOcrFile(file);
    event.target.value = '';

    setOcrLoading(true);
    toast.info("Analizando documento con OCR...");

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const fileExt = file.name.split('.').pop();
      const filePath = `${policy.client_id}/ocr-renewal-${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from('policy-documents').upload(filePath, file);
      if (uploadError) throw uploadError;

      // Ruta autoritativa devuelta por Storage. La URL firmada para n8n se
      // genera en el servidor (service role) dentro de /api/ocr-webhook.
      const storedPath = uploadData?.path ?? filePath;

      const fd = new FormData();
      fd.append('file', file);
      fd.append('clientId', policy.client_id);

      const res = await fetch('/api/ocr/extract', { method: 'POST', body: fd });
      if (!res.ok) {
        let detail = res.statusText;
        try {
          const errBody = await res.json();
          if (errBody?.error) detail = errBody.error;
        } catch { /* respuesta sin JSON */ }
        throw new Error(`Error del servidor OCR (${res.status}): ${detail}`);
      }

      const raw = await res.json();
      const ext = raw.extractedData || raw;

      console.log('OCR extraction result:', {
        extractedKeys: Object.keys(ext),
        hasNumeroPoliza: !!ext.numero_poliza,
        hasTipo: !!ext.tipo,
        hasVigencia: !!ext.vigencia_inicio && !!ext.vigencia_fin,
        extracted: ext,
      });

      // El documento nuevo manda: cada dato que el OCR logra leer pisa al de la
      // póliza anterior. Sólo se conserva el valor previo cuando el documento no
      // informa nada de ese campo.
      const text = (value: any, fallback: string) => {
        const trimmed = value === null || value === undefined ? "" : String(value).trim();
        return trimmed || fallback;
      };

      const prima = pickOcrAmount(ext, [
        "total_a_pagar", "prima_monto", "prima", "monto", "importe", "premio",
      ]);
      const tipo = matchPolicyType(ext.tipo, formData.tipo);
      const companyId = matchCompanyId(ext, companies, formData.company_id);
      const nombreAsegurado = text(ext.nombre_asegurado, formData.nombre_asegurado);

      setFormData(prev => ({
        ...prev,
        numero_poliza: text(ext.numero_poliza, prev.numero_poliza),
        company_id: companyId,
        tipo,
        vigencia_inicio: normalizeOcrDate(ext.vigencia_inicio, prev.vigencia_inicio),
        vigencia_fin: normalizeOcrDate(ext.vigencia_fin, prev.vigencia_fin),
        nombre_asegurado: nombreAsegurado,
        documento_asegurado: text(ext.documento_asegurado, prev.documento_asegurado),
        parentesco: text(ext.parentesco, prev.parentesco || "Titular"),
        prima_monto: prima !== null ? String(prima) : prev.prima_monto,
        moneda: matchCurrency(ext.moneda, prev.moneda || "UYU"),
        forma_pago: matchPaymentFrequency(ext.forma_pago ?? ext.frecuencia_pago, prev.forma_pago),
        numero_factura: text(ext.numero_factura ?? ext.factura, prev.numero_factura),
        notas: text(ext.notas, prev.notas),
      }));

      // Si el documento nombra un asegurado distinto del cliente hay que mostrar
      // esos campos: con el check puesto el submit los manda vacíos y se perdía
      // lo que acababa de leer el OCR.
      if (nombreAsegurado && !isSameName(nombreAsegurado, policy.clients.nombre)) {
        setUseClientAsInsured(false);
      }

      // Agregar el archivo a adjuntos
      setFileAttachments(prev => [...prev, {
        id: `ocr-${Date.now()}`, url: storedPath, name: file.name, isExisting: true,
      }]);

      // Avisar de lo que el documento no informó, para que no parezca que el OCR
      // "no actualizó" cuando en realidad el dato no estaba.
      const missing = [
        !ext.vigencia_fin && "vigencia",
        prima === null && "prima",
        !tipo && "tipo",
      ].filter(Boolean);

      if (missing.length) {
        toast.warning(`Datos extraídos. Revisá a mano: ${missing.join(", ")}.`);
      } else {
        toast.success("Datos extraídos del documento");
      }
    } catch (err: any) {
      toast.error("No se pudo analizar el documento: " + err.message);
    } finally {
      setOcrLoading(false);
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const filePath = `policies/${policy.client_id}/${policy.id}-renewal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const { error } = await supabase.storage.from('policy-documents').upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (error) { console.error(error); return null; }
      const { data: { publicUrl } } = supabase.storage.from('policy-documents').getPublicUrl(filePath);
      return publicUrl;
    } catch { return null; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const archivo_urls: string[] = [];
      for (const att of fileAttachments) {
        if (att.file) {
          const url = await uploadFile(att.file);
          if (url) archivo_urls.push(url);
          else { toast.error(`Error al subir ${att.name}`); return; }
        } else if (att.url) {
          archivo_urls.push(att.url);
        }
      }

      const payload = {
        ...formData,
        archivo_urls,
        status: 'Renovada',
        // Postgres rechaza "" como uuid: sin aseguradora hay que mandar null.
        company_id: formData.company_id || null,
        nombre_asegurado: useClientAsInsured ? "" : formData.nombre_asegurado,
        documento_asegurado: useClientAsInsured ? "" : formData.documento_asegurado,
        parentesco: useClientAsInsured ? "Titular" : formData.parentesco,
        prima_monto: formData.prima_monto !== "" ? parseFloat(formData.prima_monto) : null,
        moneda: formData.moneda || "UYU",
        forma_pago: formData.forma_pago || null,
        numero_factura: formData.numero_factura || null,
        notas: formData.notas || null,
      };

      const res = await fetch(`/api/policies/${policy.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Error al renovar (${res.status})`);
      }

      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al renovar la póliza.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-0 overflow-y-auto px-3 pb-3 sm:px-5 sm:pb-4 lg:overflow-hidden">
      <form onSubmit={handleSubmit} className="grid gap-2 sm:gap-3 pt-3 lg:h-full lg:grid-cols-12 lg:grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]">

        {/* OCR Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 rounded-lg border border-primary/40 bg-black/25 p-2 sm:p-3 lg:col-span-12 text-sm">
          <Wand2 className="h-4 w-4 flex-shrink-0 text-primary mt-0.5 sm:mt-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground text-sm">Cargar documento y extraer datos</p>
            <p className="text-xs text-muted-foreground">El OCR pre-llenará los campos</p>
          </div>
          <label className="cursor-pointer shrink-0">
            <Button type="button" variant="outline" size="sm" disabled={ocrLoading} asChild className="text-xs">
              <span>
                {ocrLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                <span className="hidden sm:inline">{ocrLoading ? "Analizando..." : "OCR"}</span>
              </span>
            </Button>
            <input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg" onChange={handleOcrFileChange} disabled={ocrLoading} />
          </label>
        </div>

        {/* Información General */}
        <div className="space-y-2 sm:space-y-3 rounded-lg border border-white/10 bg-black/20 p-2.5 sm:p-3 lg:col-span-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <h3 className="text-sm font-semibold">Información</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Póliza <span className="text-destructive">*</span></Label>
              <Input value={formData.numero_poliza} onChange={e => setFormData({ ...formData, numero_poliza: e.target.value })} placeholder="POL-2025-001" required className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Aseguradora</Label>
              <Select value={formData.company_id} onValueChange={v => setFormData({ ...formData, company_id: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent className="text-xs">
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Tipo <span className="text-destructive">*</span></Label>
              <Select value={formData.tipo} onValueChange={v => setFormData({ ...formData, tipo: v })} required>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent className="text-xs">
                  {POLICY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Vigencia */}
        <div className="space-y-2 sm:space-y-3 rounded-lg border border-white/10 bg-black/20 p-2.5 sm:p-3 lg:col-span-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <h3 className="text-sm font-semibold">Vigencia</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Inicio <span className="text-destructive">*</span></Label>
              <Input type="date" value={formData.vigencia_inicio} onChange={e => setFormData({ ...formData, vigencia_inicio: e.target.value })} required className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fin <span className="text-destructive">*</span></Label>
              <Input type="date" value={formData.vigencia_fin} onChange={e => setFormData({ ...formData, vigencia_fin: e.target.value })} required className="h-8 text-xs" />
            </div>
          </div>
        </div>

        {/* Asegurado */}
        <div className="space-y-2 sm:space-y-3 rounded-lg border border-white/10 bg-black/20 p-2.5 sm:p-3 lg:col-span-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <h3 className="text-sm font-semibold">Asegurado</h3>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
            <input type="checkbox" id="sameClient" checked={useClientAsInsured} onChange={e => setUseClientAsInsured(e.target.checked)} className="h-4 w-4 rounded" />
            <Label htmlFor="sameClient" className="font-normal cursor-pointer text-xs">Mismo que cliente</Label>
          </div>
          {!useClientAsInsured && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-2">
              <div className="space-y-1">
                <Label className="text-xs">Nombre</Label>
                <Input value={formData.nombre_asegurado} onChange={e => setFormData({ ...formData, nombre_asegurado: e.target.value })} placeholder="Nombre" className="h-8 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Documento</Label>
                  <Input value={formData.documento_asegurado} onChange={e => setFormData({ ...formData, documento_asegurado: e.target.value })} placeholder="CI" className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Parentesco</Label>
                  <Select value={formData.parentesco} onValueChange={v => setFormData({ ...formData, parentesco: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="text-xs">
                      {["Cónyuge","Hijo/a","Padre","Madre","Hermano/a","Familiar","Tercero","Otro"].map(p =>
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Facturación */}
        <div className="space-y-2 sm:space-y-3 rounded-lg border border-white/10 bg-black/20 p-2.5 sm:p-3 lg:col-span-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <h3 className="text-sm font-semibold">Facturación</h3>
          </div>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Prima</Label>
              <div className="flex gap-1">
                <Select value={formData.moneda} onValueChange={v => setFormData({ ...formData, moneda: v })}>
                  <SelectTrigger className="w-16 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="UYU">UYU</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" min="0" step="0.01" placeholder="0.00" className="flex-1 h-8 text-xs" value={formData.prima_monto} onChange={e => setFormData({ ...formData, prima_monto: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Forma de Pago</Label>
              <Select value={formData.forma_pago} onValueChange={v => setFormData({ ...formData, forma_pago: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent className="text-xs">
                  {PAYMENT_FREQUENCY_OPTIONS.map(f =>
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">N° Factura</Label>
              <Input placeholder="F-001234" value={formData.numero_factura} onChange={e => setFormData({ ...formData, numero_factura: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
        </div>

        {/* Documentos */}
        <div className="space-y-2 sm:space-y-3 rounded-lg border border-white/10 bg-black/20 p-2.5 sm:p-3 lg:col-span-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <h3 className="text-sm font-semibold">Documentos</h3>
          </div>
          <div className="rounded-lg border-2 border-dashed border-border bg-muted/20 p-2 text-center transition-colors hover:border-primary/50">
            <Upload className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
            <label htmlFor="renewal-file-upload" className="cursor-pointer text-xs font-medium hover:text-primary transition-colors">
              Cargar archivos
              <input id="renewal-file-upload" type="file" multiple className="sr-only" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
            </label>
            <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX</p>
          </div>
          {fileAttachments.length > 0 && (
            <div className="max-h-20 space-y-1 overflow-y-auto">
              {fileAttachments.map(att => (
                <div key={att.id} className="flex items-center justify-between rounded border bg-muted/30 p-1.5 gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-3 w-3 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{att.name}</p>
                      <p className="text-muted-foreground">
                        {att.size ? formatFileSize(att.size) : 'Existente'}
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setFileAttachments(prev => prev.filter(f => f.id !== att.id))} className="text-muted-foreground hover:text-destructive p-0 h-5 w-5">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notas */}
        <div className="space-y-1 rounded-lg border border-white/10 bg-black/20 p-2.5 sm:p-3 lg:col-span-4">
          <Label className="text-xs">Notas</Label>
          <Textarea value={formData.notas} onChange={e => setFormData({ ...formData, notas: e.target.value })} placeholder="Observaciones..." rows={2} className="resize-none text-xs" />
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-2 border-t border-white/10 pt-2 sm:pt-3 lg:col-span-12">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading} className="text-xs h-8">Cancelar</Button>
          <Button type="submit" disabled={loading} className="text-xs h-8">
            {loading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Renovando</> : "Renovar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
