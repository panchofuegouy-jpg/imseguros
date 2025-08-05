"use client"

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PolicyForm from "@/components/policy-form";
import { useIsMobile } from "@/hooks/use-mobile";
import { Mail, Phone, FileText, User, CalendarDays, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { CreateClientDialog } from "./create-client-dialog";

interface Client {
    id: string;
    nombre: string;
    email: string;
    telefono: string | null;
    documento: string;
    direccion: string | null;
    created_at: string;
    numero_cliente: number | null;
    departamento: string | null;
}

interface Policy {
    id: string;
    client_id: string;
    company_id: string | null;
    numero_poliza: string;
    tipo: string;
    vigencia_inicio: string;
    vigencia_fin: string;
    archivo_url: string | null;
    notas: string | null;
    created_at: string;
    companies?: { name: string } | null;
}

interface Company {
    id: string;
    name: string;
}

interface ClientDetailPageContentProps {
    client: Client;
    initialPolicies: Policy[];
    companies: Company[];
}

export function ClientDetailPageContent({ client, initialPolicies, companies }: ClientDetailPageContentProps) {
    const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
    const [isEditPolicyFormOpen, setIsEditPolicyFormOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deletingPolicy, setDeletingPolicy] = useState<Policy | null>(null);
    const [isDeleteClientDialogOpen, setIsDeleteClientDialogOpen] = useState(false);
    const isMobile = useIsMobile();
    const supabase = createClient();
    const router = useRouter();

    const handleClientUpdated = () => {
        setIsEditModalOpen(false);
        window.location.reload();
    };

    const handleCreatePolicy = async (policyData: any) => {
        try {
            const newPolicyData = { ...policyData, client_id: client.id };
            const { data, error } = await supabase.from("policies").insert([newPolicyData]).select("*, companies(name)").single();
            if (error) {
                throw error;
            }
            setPolicies((prev) => [...prev, data as Policy]);
            setIsFormOpen(false);
            toast.success("Póliza creada exitosamente!");
        } catch (err: any) {
            toast.error(`Error al crear la póliza: ${err.message}`);
        }
    };

    const handleUpdatePolicy = async (policyData: any) => {
        if (!editingPolicy) return;
        try {
            const { error } = await supabase
                .from("policies")
                .update(policyData)
                .eq("id", editingPolicy.id);

            if (error) {
                throw error;
            }

            const { data: updatedPolicy, error: fetchError } = await supabase
                .from("policies")
                .select("*, companies(name)")
                .eq("id", editingPolicy.id)
                .single();

            if (fetchError) {
                throw fetchError;
            }

            setPolicies((prev) =>
                prev.map((p) => (p.id === editingPolicy.id ? updatedPolicy as Policy : p))
            );
            setIsEditPolicyFormOpen(false);
            setEditingPolicy(null);
            toast.success("Póliza actualizada exitosamente!");
        } catch (err: any) {
            toast.error(`Error al actualizar la póliza: ${err.message}`);
        }
    };

    const handleDeletePolicy = async () => {
        if (!deletingPolicy) return;
        try {
            const { error } = await supabase
                .from("policies")
                .delete()
                .eq("id", deletingPolicy.id);

            if (error) {
                throw error;
            }

            if (deletingPolicy.archivo_url) {
                const filePath = new URL(deletingPolicy.archivo_url).pathname.split('/public/policy-documents/')[1];
                if (filePath) {
                    const { error: storageError } = await supabase.storage
                        .from("policy-documents")
                        .remove([filePath]);

                    if (storageError) {
                        console.error("Error deleting policy file, but policy record was deleted:", storageError);
                    }
                }
            }

            setPolicies((prev) => prev.filter((p) => p.id !== deletingPolicy.id));
            setIsDeleteDialogOpen(false);
            setDeletingPolicy(null);
            toast.success("Póliza eliminada exitosamente!");
        } catch (err: any) {
            toast.error(`Error al eliminar la póliza: ${err.message}`);
        }
    };

    const openEditForm = (policy: Policy) => {
        setEditingPolicy(policy);
        setIsEditPolicyFormOpen(true);
    };

    const openDeleteDialog = (policy: Policy) => {
        setDeletingPolicy(policy);
        setIsDeleteDialogOpen(true);
    };

    const handleDeleteClient = async () => {
        try {
            const response = await fetch(`/api/clients/${client.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al eliminar el cliente');
            }

            toast.success('Cliente eliminado exitosamente');
            router.push('/admin/clientes');
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsDeleteClientDialogOpen(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Client Details Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl flex items-center justify-between">
                        <div className="flex items-center">
                            <User className="h-6 w-6 mr-2" />
                            {client.nombre}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => setIsEditModalOpen(true)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog open={isDeleteClientDialogOpen} onOpenChange={setIsDeleteClientDialogOpen}>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta acción no se puede deshacer. Eliminará permanentemente al cliente "{client.nombre}", 
                                            todas sus pólizas asociadas, archivos y su cuenta de usuario.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteClient}>
                                            Eliminar Cliente
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardTitle>
                    <CardDescription>Detalles del Cliente</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{client.email}</span>
                    </div>
                    {client.telefono && (
                        <div className="flex items-center">
                            <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span>{client.telefono}</span>
                        </div>
                    )}
                    <div className="flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>Documento: {client.documento}</span>
                    </div>
                    {client.direccion && (
                        <div className="flex items-center">
                            <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span>Dirección: {client.direccion}</span>
                        </div>
                    )}
                    {client.numero_cliente && (
                        <div className="flex items-center">
                            <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span>Número de Cliente: {client.numero_cliente}</span>
                        </div>
                    )}
                    {client.departamento && (
                        <div className="flex items-center">
                            <CalendarDays className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span>Departamento: {client.departamento}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <CreateClientDialog
                open={isEditModalOpen}
                onOpenChange={setIsEditModalOpen}
                client={client}
                onClientUpdated={handleClientUpdated}
            />

            {/* Policies Section */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold">Pólizas Asociadas</h2>
                    <p className="text-muted-foreground">Gestiona las pólizas de {client.nombre}</p>
                </div>
                {isMobile ? (
                    <Drawer open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DrawerTrigger asChild>
                            <Button>Crear Nueva Póliza</Button>
                        </DrawerTrigger>
                        <DrawerContent className="max-h-[90vh]">
                            <DrawerHeader className="text-left">
                                <DrawerTitle>Crear Nueva Póliza</DrawerTitle>
                                <DrawerDescription>Ingresa los detalles de la nueva póliza para {client.nombre}.</DrawerDescription>
                            </DrawerHeader>
                            <div className="px-4 pb-4 overflow-y-auto">
                                <PolicyForm clients={[{ id: client.id, nombre: client.nombre }]} companies={companies} onSubmit={handleCreatePolicy} />
                            </div>
                        </DrawerContent>
                    </Drawer>
                ) : (
                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild>
                            <Button>Crear Nueva Póliza</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Crear Nueva Póliza</DialogTitle>
                                <DialogDescription>Ingresa los detalles de la nueva póliza para {client.nombre}.</DialogDescription>
                            </DialogHeader>
                            <PolicyForm clients={[{ id: client.id, nombre: client.nombre }]} companies={companies} onSubmit={handleCreatePolicy} />
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Listado de Pólizas</CardTitle>
                </CardHeader>
                <CardContent>
                    {policies.length === 0 ? (
                        <p>No hay pólizas registradas para este cliente.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Número de Póliza</TableHead>
                                    <TableHead>Aseguradora</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Inicio Vigencia</TableHead>
                                    <TableHead>Fin Vigencia</TableHead>
                                    <TableHead>Documento</TableHead>
                                    <TableHead>Notas</TableHead>
                                    <TableHead>Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {policies.map((policy) => (
                                    <TableRow key={policy.id}>
                                        <TableCell>{policy.numero_poliza}</TableCell>
                                        <TableCell>{policy.companies?.name || "N/A"}</TableCell>
                                        <TableCell>{policy.tipo}</TableCell>
                                        <TableCell>{policy.vigencia_inicio}</TableCell>
                                        <TableCell>{policy.vigencia_fin}</TableCell>
                                        <TableCell>
                                            {policy.archivo_url ? (
                                                <a href={policy.archivo_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                                    Ver Archivo
                                                </a>
                                            ) : (
                                                "N/A"
                                            )}
                                        </TableCell>
                                        <TableCell>{policy.notas}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="icon" onClick={() => openEditForm(policy)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="destructive" size="icon" onClick={() => openDeleteDialog(policy)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Edit Policy Dialog/Drawer */}
            {isMobile ? (
                <Drawer open={isEditPolicyFormOpen} onOpenChange={setIsEditPolicyFormOpen}>
                    <DrawerContent className="max-h-[90vh]">
                        <DrawerHeader className="text-left">
                            <DrawerTitle>Editar Póliza</DrawerTitle>
                            <DrawerDescription>Actualiza los detalles de la póliza.</DrawerDescription>
                        </DrawerHeader>
                        <div className="px-4 pb-4 overflow-y-auto">
                            <PolicyForm
                                clients={[{ id: client.id, nombre: client.nombre }]}
                                companies={companies}
                                onSubmit={handleUpdatePolicy}
                                initialData={editingPolicy}
                            />
                        </div>
                    </DrawerContent>
                </Drawer>
            ) : (
                <Dialog open={isEditPolicyFormOpen} onOpenChange={setIsEditPolicyFormOpen}>
                    <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Editar Póliza</DialogTitle>
                            <DialogDescription>Actualiza los detalles de la póliza.</DialogDescription>
                        </DialogHeader>
                        <PolicyForm
                            clients={[{ id: client.id, nombre: client.nombre }]}
                            companies={companies}
                            onSubmit={handleUpdatePolicy}
                            initialData={editingPolicy}
                        />
                    </DialogContent>
                </Dialog>
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto eliminará permanentemente la póliza y sus archivos asociados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeletingPolicy(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeletePolicy}>Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
