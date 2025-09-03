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
import { MoreHorizontal, RefreshCw, Edit, CheckCircle, AlertCircle, Clock, XCircle, Phone } from "lucide-react";
import Link from "next/link";

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
  { value: 'Pendiente', label: 'Pendiente', color: 'bg-gray-500' },
  { value: 'Contactado', label: 'Contactado', color: 'bg-blue-500' },
  { value: 'En Proceso', label: 'En Proceso', color: 'bg-yellow-500' },
  { value: 'Renovada', label: 'Renovada', color: 'bg-green-500' },
  { value: 'No Renovada', label: 'No Renovada', color: 'bg-red-500' },
];

const POLICY_TYPES = ["Auto", "Vida", "Hogar", "Comercial", "Salud"];

export function PoliciesNearExpirationContent() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
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
    if (selectedStatus && selectedStatus !== 'all') params.append('status', selectedStatus);

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
  };

  // Filtrar pólizas por cliente localmente
  const filteredPolicies = policies.filter(policy => {
    if (clientSearchTerm.trim() === "") return true;
    
    const searchLower = clientSearchTerm.toLowerCase();
    return (
      policy.clients.nombre.toLowerCase().includes(searchLower) ||
      (policy.clients.telefono && policy.clients.telefono.includes(clientSearchTerm)) ||
      (policy.clients.email && policy.clients.email.toLowerCase().includes(searchLower))
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
  }, [selectedMonth, selectedCompany, selectedType, selectedStatus]);

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
            Gestiona las renovaciones de pólizas próximas a vencer
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
                placeholder="Buscar por nombre de cliente o número..."
                value={clientSearchTerm}
                onChange={(e) => setClientSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            
            {/* Otros filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

            <div>
              <label className="text-sm font-medium mb-2 block">Estado</label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {STATUS_OPTIONS.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de pólizas */}
      <Card>
        <CardHeader>
          <CardTitle>
            Pólizas por Vencer ({filteredPolicies.length}{filteredPolicies.length !== policies.length ? ` de ${policies.length}` : ''})
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
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => handleRenewal(policy)}
                                className="cursor-pointer"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Renovar Póliza
                              </DropdownMenuItem>
                              
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

// Componente completo para renovación de pólizas
function RenewalForm({ policy, companies, onSuccess, onCancel }: {
  policy: Policy;
  companies: Company[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    numero_poliza: policy.numero_poliza,
    company_id: policy.company_id || "",
    vigencia_inicio: policy.vigencia_inicio,
    vigencia_fin: policy.vigencia_fin,
    notas: policy.notas || "",
  });
  const [fileAttachments, setFileAttachments] = useState(() => {
    if (policy.archivo_urls && Array.isArray(policy.archivo_urls)) {
      return policy.archivo_urls.map((url: string, index: number) => ({
        id: `existing-${index}`,
        url,
        name: `Archivo ${index + 1}`,
        isExisting: true,
      }));
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Manejar cambio de archivos
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);

    selectedFiles.forEach(file => {
      // Validar tipo de archivo (PDF, DOC, DOCX)
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      if (allowedTypes.includes(file.type)) {
        const newAttachment = {
          id: `new-${Date.now()}-${Math.random()}`,
          file,
          name: file.name,
          size: file.size,
          isExisting: false,
        };

        setFileAttachments(prev => [...prev, newAttachment]);
      } else {
        toast.error(`El archivo ${file.name} no es válido. Solo se permiten archivos PDF, DOC o DOCX`);
      }
    });

    // Reset input
    event.target.value = '';
  };

  // Remover archivo
  const removeFile = (fileId: string) => {
    setFileAttachments(prev => prev.filter(file => file.id !== fileId));
  };

  // Subir archivo
  const uploadFile = async (file: File, policyId: string, clientId: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${policyId}-renewal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `policies/${clientId}/${fileName}`;

      // Crear cliente Supabase
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { data, error } = await supabase.storage
        .from("policy-documents")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error("Error uploading file:", error);
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from("policy-documents")
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  };

  // Formatear tamaño de archivo
  const formatFileSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setUploading(true);

    try {
      const archivo_urls: string[] = [];

      // Procesar archivos
      for (const attachment of fileAttachments) {
        if (attachment.file) {
          // Nuevo archivo a subir
          const uploadedUrl = await uploadFile(attachment.file, policy.id, policy.client_id);
          if (uploadedUrl) {
            archivo_urls.push(uploadedUrl);
          } else {
            toast.error(`Error al subir el archivo ${attachment.name}`);
            return;
          }
        } else if (attachment.url) {
          // Archivo existente
          archivo_urls.push(attachment.url);
        }
      }

      const response = await fetch(`/api/policies/${policy.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          archivo_urls,
          status: 'Renovada'
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        throw new Error('Error al renovar');
      }
    } catch (error) {
      toast.error("Error al renovar la póliza.");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Número de Póliza y Aseguradora */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="numero_poliza" className="block text-sm font-medium mb-2">
              Número de Póliza
            </label>
            <input
              type="text"
              id="numero_poliza"
              value={formData.numero_poliza}
              onChange={(e) => setFormData({ ...formData, numero_poliza: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: POL-2024-001"
              required
            />
          </div>
          
          <div>
            <label htmlFor="company_id" className="block text-sm font-medium mb-2">
              Aseguradora
            </label>
            <Select
              value={formData.company_id}
              onValueChange={(value) => setFormData({ ...formData, company_id: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar aseguradora" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Fechas */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="vigencia_inicio" className="block text-sm font-medium mb-2">
              Nueva Fecha de Inicio
            </label>
            <input
              type="date"
              id="vigencia_inicio"
              value={formData.vigencia_inicio}
              onChange={(e) => setFormData({ ...formData, vigencia_inicio: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label htmlFor="vigencia_fin" className="block text-sm font-medium mb-2">
              Nueva Fecha de Fin
            </label>
            <input
              type="date"
              id="vigencia_fin"
              value={formData.vigencia_fin}
              onChange={(e) => setFormData({ ...formData, vigencia_fin: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>
        
        {/* Archivos */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Documentos de la Renovación</h3>
          
          {/* Área de carga */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
            <div className="space-y-2">
              <svg className="mx-auto h-8 w-8 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-sm font-medium text-blue-600 hover:text-blue-500">
                    Cargar archivos de renovación
                  </span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    multiple
                    className="sr-only"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                  />
                </label>
                <p className="text-sm text-gray-500">o arrastra archivos aquí</p>
              </div>
              <p className="text-xs text-gray-500">
                PDF, DOC, DOCX hasta 10MB cada uno
              </p>
            </div>
          </div>

          {/* Lista de archivos */}
          {fileAttachments.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900">
                  Archivos adjuntos ({fileAttachments.length})
                </h4>
              </div>
              <div className="space-y-2">
                {fileAttachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {attachment.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {attachment.size ? formatFileSize(attachment.size) : 'Archivo existente'}
                          {attachment.isExisting && ' (actual)'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(attachment.id)}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Notas */}
        <div>
          <label htmlFor="notas" className="block text-sm font-medium mb-2">
            Notas de Renovación
          </label>
          <textarea
            id="notas"
            value={formData.notas}
            onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
            placeholder="Agregar notas sobre la renovación..."
          />
        </div>
        
        {/* Botones */}
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading || uploading}>
            {uploading ? "Subiendo archivos..." : (loading ? "Renovando..." : "Renovar Póliza")}
          </Button>
        </div>
      </form>
    </div>
  );
}
