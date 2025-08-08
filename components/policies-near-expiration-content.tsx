"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  };

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
          <h1 className="text-3xl font-bold">CRM - Renovación de Pólizas</h1>
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
        </CardContent>
      </Card>

      {/* Tabla de pólizas */}
      <Card>
        <CardHeader>
          <CardTitle>
            Pólizas por Vencer ({policies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Cargando pólizas...</div>
          ) : policies.length === 0 ? (
            <div className="text-center py-8">No hay pólizas que coincidan con los filtros seleccionados.</div>
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
                  {policies.map((policy) => {
                    const daysUntilExpiration = getDaysUntilExpiration(policy.vigencia_fin);
                    const isUrgent = daysUntilExpiration <= 7;
                    
                    return (
                      <TableRow key={policy.id} className={isUrgent ? "bg-red-50" : ""}>
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
                                📞 {policy.clients.telefono}
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

// Componente simplificado para renovación de pólizas
function RenewalForm({ policy, companies, onSuccess, onCancel }: {
  policy: Policy;
  companies: Company[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    vigencia_inicio: policy.vigencia_inicio,
    vigencia_fin: policy.vigencia_fin,
    notas: policy.notas || "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/policies/${policy.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
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
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
      
      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Renovando..." : "Renovar Póliza"}
        </Button>
      </div>
    </form>
  );
}
