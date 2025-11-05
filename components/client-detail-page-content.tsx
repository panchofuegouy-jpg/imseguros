"use client"

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PolicyForm from "@/components/policy-form";
import { useIsMobile } from "@/hooks/use-mobile";
import { Mail, Phone, FileText, User, CalendarDays, Edit, Trash2, ExternalLink, Search } from 'lucide-react';
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
    archivo_urls: string[] | null;
    notas: string | null;
    nombre_asegurado: string | null;
    documento_asegurado: string | null;
    parentesco: string;
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
    const [searchTerm, setSearchTerm] = useState("");
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
    const [isEditPolicyFormOpen, setIsEditPolicyFormOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deletingPolicy, setDeletingPolicy] = useState<Policy | null>(null);
    const [isDeleteClientDialogOpen, setIsDeleteClientDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
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
            console.log("Creating policy with data:", newPolicyData);

            const { data, error } = await supabase
                .from("policies")
                .insert([newPolicyData])
                .select("*, companies(name)")
                .single();

            if (error) {
                console.error("Error creating policy:", error);
                throw error;
            }

            console.log("Policy created successfully:", data);
            setPolicies((prev) => [...prev, data as Policy]);
            setIsFormOpen(false);
            toast.success("Póliza creada exitosamente!");
        } catch (err: any) {
            console.error("Error in handleCreatePolicy:", err);
            toast.error(`Error al crear la póliza: ${err.message}`);
        }
    };

    const handleUpdatePolicy = async (policyData: any) => {
        if (!editingPolicy) return;
        try {
            console.log("Updating policy with data:", policyData);

            const { error } = await supabase
                .from("policies")
                .update(policyData)
                .eq("id", editingPolicy.id);

            if (error) {
                console.error("Error updating policy:", error);
                throw error;
            }

            const { data: updatedPolicy, error: fetchError } = await supabase
                .from("policies")
                .select("*, companies(name)")
                .eq("id", editingPolicy.id)
                .single();

            if (fetchError) {
                console.error("Error fetching updated policy:", fetchError);
                throw fetchError;
            }

            console.log("Policy updated successfully:", updatedPolicy);
            setPolicies((prev) =>
                prev.map((p) => (p.id === editingPolicy.id ? updatedPolicy as Policy : p))
            );
            setIsEditPolicyFormOpen(false);
            setEditingPolicy(null);
            toast.success("Póliza actualizada exitosamente!");
        } catch (err: any) {
            console.error("Error in handleUpdatePolicy:", err);
            toast.error(`Error al actualizar la póliza: ${err.message}`);
        }
    };

    const deleteFilesFromStorage = async (urls: string[]) => {
        const deletePromises = urls.map(async (url) => {
            try {
                // Extract file path from URL
                const urlParts = url.split('/');
                const bucketIndex = urlParts.findIndex(part => part === 'policy-documents');
                if (bucketIndex === -1) {
                    console.warn("Could not find bucket in URL:", url);
                    return;
                }

                const filePath = urlParts.slice(bucketIndex + 1).join('/');
                console.log("Deleting file from storage:", filePath);

                const { error } = await supabase.storage
                    .from("policy-documents")
                    .remove([filePath]);

                if (error) {
                    console.error("Error deleting file from storage:", error);
                } else {
                    console.log("File deleted successfully from storage:", filePath);
                }
            } catch (error) {
                console.error("Error processing file deletion:", error);
            }
        });

        await Promise.all(deletePromises);
    };

    const handleDeletePolicy = async () => {
        if (!deletingPolicy) return;

        setIsDeleting(true);
        console.log("=== STARTING POLICY DELETION (DIRECT) ===");
        console.log("Policy to delete:", deletingPolicy);

        try {
            // Verificar autenticación
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            console.log("Current user:", user?.email);
            if (authError || !user) {
                throw new Error("Usuario no autenticado");
            }

            // Verificar permisos del usuario
            const { data: userProfile, error: profileError } = await supabase
                .from("user_profiles")
                .select("role, client_id")
                .eq("id", user.id)
                .single();

            if (profileError) {
                console.error("Error fetching user profile:", profileError);
                throw new Error("Error al verificar permisos de usuario");
            }

            console.log("User profile:", userProfile);

            const isAdmin = userProfile?.role === 'admin';
            const isOwner = userProfile?.client_id === deletingPolicy.client_id;

            if (!isAdmin && !isOwner) {
                throw new Error("No tienes permisos para eliminar esta póliza");
            }

            // Collect all file URLs to delete
            const filesToDelete: string[] = [];
            if (deletingPolicy.archivo_urls && Array.isArray(deletingPolicy.archivo_urls)) {
                filesToDelete.push(...deletingPolicy.archivo_urls);
            }
            if (deletingPolicy.archivo_url) {
                filesToDelete.push(deletingPolicy.archivo_url);
            }
            console.log("Files to delete:", filesToDelete);

            // Delete policy from database
            console.log("Deleting policy from database...");
            const { error: deleteError } = await supabase
                .from("policies")
                .delete()
                .eq("id", deletingPolicy.id);

            if (deleteError) {
                console.error("Error deleting policy from database:", deleteError);
                throw deleteError;
            }

            console.log("Policy deleted from database successfully");

            // Delete files from storage
            if (filesToDelete.length > 0) {
                console.log("Deleting files from storage...");
                await deleteFilesFromStorage(filesToDelete);
            }

            console.log("=== POLICY DELETION COMPLETED SUCCESSFULLY ===");

            // Update local state
            setPolicies((prev) => prev.filter((p) => p.id !== deletingPolicy.id));
            setIsDeleteDialogOpen(false);
            setDeletingPolicy(null);
            toast.success("Póliza eliminada exitosamente!");

            // Force refresh to ensure data consistency
            setTimeout(() => {
                router.refresh();
            }, 1000);

        } catch (err: any) {
            console.error("=== ERROR IN POLICY DELETION ===");
            console.error("Error details:", err);
            toast.error(`Error al eliminar la póliza: ${err.message}`);
        } finally {
            setIsDeleting(false);
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

    const filteredPolicies = policies.filter(policy => {
        if (searchTerm.trim() === "") return true;
        
        const searchLower = searchTerm.toLowerCase();
        const searchTerm_trim = searchTerm.trim();
        
        return (
            policy.numero_poliza.toLowerCase().includes(searchLower) ||
            policy.tipo.toLowerCase().includes(searchLower) ||
            (policy.companies?.name && policy.companies.name.toLowerCase().includes(searchLower)) ||
            (policy.nombre_asegurado && policy.nombre_asegurado.toLowerCase().includes(searchLower)) ||
            (policy.documento_asegurado && policy.documento_asegurado.includes(searchTerm_trim)) ||
            (policy.parentesco && policy.parentesco.toLowerCase().includes(searchLower)) ||
            (policy.notas && policy.notas.toLowerCase().includes(searchLower)) ||
            (client.telefono && client.telefono.includes(searchTerm_trim)) ||
            policy.vigencia_inicio.includes(searchTerm_trim) ||
            policy.vigencia_fin.includes(searchTerm_trim)
        );
    });

    const renderPolicyFiles = (policy: Policy) => {
        const files: string[] = [];

        if (policy.archivo_urls && Array.isArray(policy.archivo_urls)) {
            files.push(...policy.archivo_urls);
        }
        if (policy.archivo_url && !files.includes(policy.archivo_url)) {
            files.push(policy.archivo_url);
        }

        if (files.length === 0) {
            return <span className="text-muted-foreground">Sin archivos</span>;
        }

        return (
            <div className="space-y-1">
                {files.map((url, index) => (
                    <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center text-primary hover:underline text-sm"
                    >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Archivo {index + 1}
                    </a>
                ))}
            </div>
        );
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
                    <div className="flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>Número de Cliente: <strong className="text-primary">#{client.numero_cliente || 'N/A'}</strong></span>
                    </div>
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
            </div>

            {/* Search Filter */}
            <div className="flex items-center space-x-2">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por número de póliza, aseguradora, tipo, teléfono, notas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <div className="flex justify-end">
                <div>
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
                </di            <Card>
                <CardHeader>
                    <CardTitle>
                        Listado de Pólizas ({filteredPolicies.length}{filteredPolicies.length !== policies.length ? ` de ${policies.length}` : ''})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {filteredPolicies.length === 0 ? (
                        <p>{policies.length === 0 ? "No hay pólizas registradas para este cliente." : "No se encontraron pólizas que coincidan con la búsqueda."}</p>
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
                                    <TableHead>Documentos</TableHead>
                                    <TableHead>Notas</TableHead>
                                    <TableHead>Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPolicies.map((policy) => (
                                    <TableRow key={policy.id}>
                                        <TableCell>{policy.numero_poliza}</TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">
                                                    {policy.nombre_asegurado || client.nombre}
                                                </p>
                                                {policy.nombre_asegurado && (
                                                    <p className="text-sm text-muted-foreground">
                                                        {policy.parentesco} de {client.nombre}
                                                    </p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{policy.companies?.name || "N/A"}</TableCell>
                                        <TableCell>{policy.tipo}</TableCell>
                                        <TableCell>{policy.vigencia_inicio}</TableCell>
                                        <TableCell>{policy.vigencia_fin}</TableCell>
                                        <TableCell>
                                            {renderPolicyFiles(policy)}
                                        </TableCell>
                                        <TableCell>{policy.notas || "N/A"}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="icon" onClick={() => openEditForm(policy)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="icon"
                                                    onClick={() => openDeleteDialog(policy)}
                                                    disabled={isDeleting}
                                                >
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
                            Esta acción no se puede deshacer. Esto eliminará permanentemente la póliza "{deletingPolicy?.numero_poliza}" y todos sus archivos asociados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeletingPolicy(null)} disabled={isDeleting}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeletePolicy} disabled={isDeleting}>
                            {isDeleting ? "Eliminando..." : "Eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
