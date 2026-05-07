"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PolicyForm from "@/components/policy-form";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MoreHorizontal, RefreshCw, Edit, CheckCircle, AlertCircle, Clock, XCircle, Phone, MessageCircle, Upload, FileText, X, User, Wand2 } from "lucide-react";
import Link from "next/link";
import { normalizeOcrDate } from "@/lib/ocr-date";

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
  { value: 'Contactado', label: 'Contactado', color: 'bg-green-600', activeTab: 'pending' },
  { value: 'En Proceso', label: 'En Proceso', color: 'bg-yellow-500', activeTab: 'pending' },
  { value: 'Renovada', label: 'Renovada', color: 'bg-green-500', activeTab: 'history' },
  { value: 'No Renovada', label: 'No Renovada', color: 'bg-red-500', activeTab: 'pending' },
];

const POLICY_TYPES = ["Auto", "Vida", "Hogar", "Comercial", "Salud"];

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
  
  // Dialogo de renovación
  const [renewalDialogOpen, setRenewalDialogOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);

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

  // Obtener badge de estado
  const getStatusBadge = (status: string) => {
    const statusConfig = STATUS_OPTIONS.find(s => s.value === status);
    if (!statusConfig) return null;

    return (
      <Badge className={`text-white ${statusConfig.color}`}>
        {statusConfig.label}
      </Badge>
    );
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES');
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Renovación de Pólizas</h1>
          <p className="text-muted-foreground">
            {activeTab === 'pending' 
              ? 'Gestiona las renovaciones de pólizas próximas a vencer'
              : 'Historial de pólizas renovadas'}
          </p>
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

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => handleTabChange('pending')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'pending'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Pendientes de Renovación
        </button>
        <button
          onClick={() => handleTabChange('history')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Historial de Renovadas
        </button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Filtros de Búsqueda
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
            >
              Limpiar Filtros
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Campo de búsqueda por cliente */}
            <div>
              <label className="text-sm font-medium mb-2 block">Buscar Cliente</label>
              <Input
                type="text"
                placeholder="Buscar por cliente, aseguradora, póliza, teléfono o email..."
                value={clientSearchTerm}
                onChange={(e) => setClientSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            
            {/* Otros filtros */}
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
        </CardContent>
      </Card>

      {/* Tabla de pólizas */}
      <Card>
        <CardHeader>
          <CardTitle>
            {activeTab === 'pending' 
              ? `Pólizas por Vencer (${filteredPolicies.length}${filteredPolicies.length !== policies.length ? ` de ${policies.length}` : ''})` 
              : `Pólizas Renovadas (${filteredPolicies.length}${filteredPolicies.length !== policies.length ? ` de ${policies.length}` : ''})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Cargando pólizas...</div>
          ) : filteredPolicies.length === 0 ? (
            <div className="text-center py-8">
              {policies.length === 0 
                ? "No hay pólizas que coincidan con los filtros seleccionados." 
                : "No se encontraron pólizas con ese cliente."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>Póliza</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Aseguradora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Vence en</TableHead>
                    <TableHead>Fecha Vencimiento</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPolicies.map((policy) => {
                    const daysUntilExpiration = getDaysUntilExpiration(policy.vigencia_fin);
                    const isUrgent = daysUntilExpiration <= 7;
                    const isExpired = daysUntilExpiration <= 0;
                    
                    return (
                      <TableRow key={policy.id} className={isExpired ? "bg-red-500/20" : isUrgent ? "bg-red-500/20" : ""}>
                        <TableCell>
                          {getStatusBadge(policy.status)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {policy.numero_poliza}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <Link
                              href={`/admin/clientes/${policy.client_id}`}
                              className="text-blue-600 hover:underline font-medium"
                            >
                              {policy.clients.nombre}
                            </Link>
                            {policy.clients.telefono && (
                              <span className="text-sm text-muted-foreground">
                                {policy.clients.telefono}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{policy.companies.name}</TableCell>
                        <TableCell>{policy.tipo}</TableCell>
                        <TableCell>
                          <div className={`font-medium ${isUrgent ? 'text-red-600' : daysUntilExpiration <= 15 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {daysUntilExpiration > 0 
                              ? `${daysUntilExpiration} días` 
                              : `Vencida (${Math.abs(daysUntilExpiration)} días)`
                            }
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatDate(policy.vigencia_fin)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRenewal(policy)}
                              className="h-8 px-2 text-xs"
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
                                  className="h-8 px-2 text-xs text-green-700 border-green-300 hover:bg-green-50"
                                >
                                  <MessageCircle className="h-3 w-3 mr-1" />
                                  WA
                                </Button>
                              ) : null;
                            })()}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                {policy.clients.telefono && (
                                  <DropdownMenuItem
                                    onClick={() => window.open(`tel:${policy.clients.telefono}`, '_self')}
                                    className="cursor-pointer"
                                  >
                                    <Phone className="h-4 w-4 mr-2" />
                                    Llamar Cliente
                                  </DropdownMenuItem>
                                )}
                                <div className="border-t my-1" />
                                <div className="px-2 py-1 text-sm font-medium text-muted-foreground">
                                  Cambiar Estado:
                                </div>
                                {STATUS_OPTIONS.map((status) => (
                                  <DropdownMenuItem
                                    key={status.value}
                                    onClick={() => updatePolicyStatus(policy.id, status.value)}
                                    className="cursor-pointer"
                                    disabled={policy.status === status.value}
                                  >
                                    <div className={`h-2 w-2 rounded-full mr-2 ${status.color}`} />
                                    {status.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de renovación */}
      <Dialog open={renewalDialogOpen} onOpenChange={setRenewalDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
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
  const N8N_WEBHOOK_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'https://centro-n8n.xqnwvv.easypanel.host/webhook/75fb7c2d-82f0-4514-b137-6aee42432f42';

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
      const { error: uploadError } = await supabase.storage.from('policy-documents').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('policy-documents').getPublicUrl(filePath);

      const fd = new FormData();
      fd.append('file', file);
      fd.append('fileUrl', publicUrl);
      fd.append('clientId', policy.client_id);
      fd.append('fileName', file.name);

      const res = await fetch(N8N_WEBHOOK_URL, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Error OCR: ${res.statusText}`);

      const raw = await res.json();
      const ext = parseOcrData(raw);

      const parsePrima = (v: any) => {
        if (!v) return "";
        const n = parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
        return isNaN(n) ? "" : String(n);
      };

      setFormData(prev => ({
        ...prev,
        numero_poliza: ext.numero_poliza || prev.numero_poliza,
        tipo: ext.tipo || prev.tipo,
        vigencia_inicio: normalizeOcrDate(ext.vigencia_inicio, prev.vigencia_inicio),
        vigencia_fin: normalizeOcrDate(ext.vigencia_fin, prev.vigencia_fin),
        nombre_asegurado: ext.nombre_asegurado || prev.nombre_asegurado,
        documento_asegurado: ext.documento_asegurado || prev.documento_asegurado,
        parentesco: ext.parentesco || prev.parentesco,
        prima_monto: parsePrima(ext.total_a_pagar ?? ext.prima_monto ?? ext.prima ?? ext.monto ?? ext.importe ?? ext.premio) || prev.prima_monto,
        moneda: ext.moneda || prev.moneda,
        forma_pago: ext.forma_pago ?? ext.frecuencia_pago ?? prev.forma_pago,
        numero_factura: ext.numero_factura ?? ext.factura ?? prev.numero_factura,
      }));

      // Agregar el archivo a adjuntos
      setFileAttachments(prev => [...prev, {
        id: `ocr-${Date.now()}`, url: publicUrl, name: file.name, isExisting: true,
      }]);

      toast.success("Datos extraídos del documento");
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
        nombre_asegurado: useClientAsInsured ? "" : formData.nombre_asegurado,
        documento_asegurado: useClientAsInsured ? "" : formData.documento_asegurado,
        parentesco: useClientAsInsured ? "Titular" : formData.parentesco,
        prima_monto: formData.prima_monto !== "" ? parseFloat(formData.prima_monto) : null,
        moneda: formData.moneda || "UYU",
        forma_pago: formData.forma_pago || null,
        numero_factura: formData.numero_factura || null,
      };

      const res = await fetch(`/api/policies/${policy.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) onSuccess();
      else throw new Error('Error al renovar');
    } catch {
      toast.error("Error al renovar la póliza.");
    } finally {
      setLoading(false);
    }
  };

  const POLICY_TYPES = ["Auto", "Vida", "Hogar", "Salud", "Empresarial", "Camiones", "Taxi", "Agricola", "Motos", "Lancha", "Otro"];

  return (
    <div className="max-h-[80vh] overflow-y-auto pr-1">
      <form onSubmit={handleSubmit} className="space-y-8">

        {/* OCR Banner */}
        <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Wand2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Cargar documento de renovación y extraer datos automáticamente</p>
            <p className="text-xs text-blue-700 dark:text-blue-300">El OCR leerá el documento y pre-llenará los campos del formulario</p>
          </div>
          <label className="cursor-pointer">
            <Button type="button" variant="outline" size="sm" disabled={ocrLoading} asChild>
              <span>
                {ocrLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                {ocrLoading ? "Analizando..." : "Analizar con OCR"}
              </span>
            </Button>
            <input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg" onChange={handleOcrFileChange} disabled={ocrLoading} />
          </label>
        </div>

        {/* Información General */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            <h3 className="text-base font-semibold">Información General</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Número de Póliza <span className="text-destructive">*</span></Label>
              <Input value={formData.numero_poliza} onChange={e => setFormData({ ...formData, numero_poliza: e.target.value })} placeholder="Ej: POL-2025-001" required />
            </div>
            <div className="space-y-2">
              <Label>Aseguradora</Label>
              <Select value={formData.company_id} onValueChange={v => setFormData({ ...formData, company_id: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar aseguradora" /></SelectTrigger>
                <SelectContent>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Póliza <span className="text-destructive">*</span></Label>
              <Select value={formData.tipo} onValueChange={v => setFormData({ ...formData, tipo: v })} required>
                <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                <SelectContent>
                  {POLICY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Vigencia */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            <h3 className="text-base font-semibold">Nueva Vigencia</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha de Inicio <span className="text-destructive">*</span></Label>
              <Input type="date" value={formData.vigencia_inicio} onChange={e => setFormData({ ...formData, vigencia_inicio: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Fecha de Fin <span className="text-destructive">*</span></Label>
              <Input type="date" value={formData.vigencia_fin} onChange={e => setFormData({ ...formData, vigencia_fin: e.target.value })} required />
            </div>
          </div>
        </div>

        {/* Asegurado */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            <User className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold">Información del Asegurado</h3>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
            <input type="checkbox" id="sameClient" checked={useClientAsInsured} onChange={e => setUseClientAsInsured(e.target.checked)} className="h-4 w-4" />
            <Label htmlFor="sameClient" className="font-normal cursor-pointer">El asegurado es el mismo cliente ({policy.clients.nombre})</Label>
          </div>
          {!useClientAsInsured && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg border">
              <div className="space-y-2">
                <Label>Nombre del Asegurado</Label>
                <Input value={formData.nombre_asegurado} onChange={e => setFormData({ ...formData, nombre_asegurado: e.target.value })} placeholder="Nombre completo" />
              </div>
              <div className="space-y-2">
                <Label>Documento</Label>
                <Input value={formData.documento_asegurado} onChange={e => setFormData({ ...formData, documento_asegurado: e.target.value })} placeholder="CI del asegurado" />
              </div>
              <div className="space-y-2">
                <Label>Parentesco</Label>
                <Select value={formData.parentesco} onValueChange={v => setFormData({ ...formData, parentesco: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Cónyuge","Hijo/a","Padre","Madre","Hermano/a","Familiar","Tercero","Otro"].map(p =>
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Facturación */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            <h3 className="text-base font-semibold">Facturación</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prima / Monto</Label>
              <div className="flex gap-2">
                <Select value={formData.moneda} onValueChange={v => setFormData({ ...formData, moneda: v })}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UYU">UYU</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" min="0" step="0.01" placeholder="0.00" className="flex-1" value={formData.prima_monto} onChange={e => setFormData({ ...formData, prima_monto: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Forma de Pago</Label>
              <Select value={formData.forma_pago} onValueChange={v => setFormData({ ...formData, forma_pago: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar frecuencia" /></SelectTrigger>
                <SelectContent>
                  {["Mensual","Bimestral","Trimestral","Semestral","Anual","Contado"].map(f =>
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>N° de Factura / Recibo</Label>
              <Input placeholder="Ej: F-001234" value={formData.numero_factura} onChange={e => setFormData({ ...formData, numero_factura: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Documentos */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            <h3 className="text-base font-semibold">Documentos</h3>
          </div>
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors bg-muted/20">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <label htmlFor="renewal-file-upload" className="cursor-pointer text-sm font-medium hover:text-primary transition-colors">
              Cargar archivos adjuntos
              <input id="renewal-file-upload" type="file" multiple className="sr-only" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
            </label>
            <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX hasta 10MB</p>
          </div>
          {fileAttachments.length > 0 && (
            <div className="space-y-2">
              {fileAttachments.map(att => (
                <div key={att.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{att.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {att.size ? formatFileSize(att.size) : 'Archivo existente'}
                        {att.isExisting && ' (actual)'}
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setFileAttachments(prev => prev.filter(f => f.id !== att.id))} className="text-muted-foreground hover:text-destructive">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notas */}
        <div className="space-y-2">
          <Label>Notas de Renovación</Label>
          <Textarea value={formData.notas} onChange={e => setFormData({ ...formData, notas: e.target.value })} placeholder="Observaciones sobre la renovación..." rows={3} className="resize-none" />
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Renovando...</> : "Confirmar Renovación"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Parser de datos OCR (mismo formato que multi-file-policy-uploader)
function parseOcrData(payload: any): any {
  const normalize = (value: any): any => {
    if (!value) return undefined;
    if (typeof value === 'string') {
      try { return normalize(JSON.parse(value)); } catch { return undefined; }
    }
    if (Array.isArray(value)) return fromArray(value);
    if (typeof value === 'object') return value;
    return undefined;
  };
  const fromArray = (value: any): any => {
    if (!Array.isArray(value) || value.length === 0) return undefined;
    const first = value[0];
    return normalize(first?.extractedData || first?.data || first?.json || first?.output?.[0]?.content?.[0]?.text || first?.output?.[0]?.json || first);
  };
  const candidates = [
    normalize(payload?.extractedData),
    normalize(payload?.data),
    normalize(payload?.output?.[0]?.content?.[0]?.text || payload?.output?.[0]?.json),
    fromArray(payload),
    normalize(payload),
  ].filter(Boolean);
  return candidates[0] || {};
}
