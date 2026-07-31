"use client"

import { useState, useEffect } from "react";
import { fetchAllSupabaseRows } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/client";
import { resolvePolicyFileUrl } from "@/lib/policy-file-url";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PolicyForm from "@/components/policy-form";
import { useIsMobile } from "@/hooks/use-mobile";
import { Mail, Phone, User, Edit, Trash2, ExternalLink, Search, MessageCircle, Send, MapPin, IdCard, Building2, Hash, Sparkles } from 'lucide-react';
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { CreateClientDialog } from "./create-client-dialog";
import { MultiFilePolicyUploader } from "./multi-file-policy-uploader";
import { PolicyOcrUpdateDialog } from "./policy-ocr-update-dialog";

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
    prima_monto: number | null;
    moneda: string | null;
    forma_pago: string | null;
    numero_factura: string | null;
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
    hasAccount: boolean;
}

export function ClientDetailPageContent({ client, initialPolicies, companies, hasAccount }: ClientDetailPageContentProps) {
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
    const [validatedFiles, setValidatedFiles] = useState<Record<string, string[]>>({});
    const [isSendCredentialsOpen, setIsSendCredentialsOpen] = useState(false);
    const [isSendingCredentials, setIsSendingCredentials] = useState(false);
    const [credentialsEmail, setCredentialsEmail] = useState(client.email);
    const [sentTempPassword, setSentTempPassword] = useState<string | null>(null);
    const isMobile = useIsMobile();
    const supabase = createClient();
    const router = useRouter();

    // Fetch latest policies from Supabase for this client to ensure we
    // reflect any server-side changes (uploads that updated archivo_urls, etc.)
    const fetchPolicies = async () => {
        try {
            const { data, error } = await fetchAllSupabaseRows((from, to) =>
                supabase
                    .from('policies')
                    .select('*, companies(name)')
                    .eq('client_id', client.id)
                    .order('created_at', { ascending: false })
                    .range(from, to)
            );

            if (error) {
                console.error('Error fetching policies:', error);
                return;
            }

            console.log('Fetched policies from DB for client', client.id, data);
            setPolicies(data as Policy[]);
        } catch (err) {
            console.error('Unexpected error fetching policies:', err);
        }
    };

    useEffect(() => {
        // Fetch once on mount (and when client.id changes)
        fetchPolicies();
    }, [client.id]);

    const handleClientUpdated = () => {
        setIsEditModalOpen(false);
        window.location.reload();
    };

    const handleSendCredentials = async () => {
        if (!credentialsEmail) {
            toast.error("Email es requerido");
            return;
        }

        setIsSendingCredentials(true);
        try {
            const response = await fetch(`/api/clients/${client.id}/resend-credentials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    newEmail: credentialsEmail !== client.email ? credentialsEmail : undefined
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al enviar credenciales');
            }

            const data = await response.json();
            setSentTempPassword(data.tempPassword);

            setIsSendCredentialsOpen(false);
            toast.success(`Credenciales enviadas a ${credentialsEmail}. Contraseña temporal: ${data.tempPassword}`);

            // Si el email cambió, actualizar el estado
            if (credentialsEmail !== client.email) {
                client.email = credentialsEmail;
            }
        } catch (error: any) {
            toast.error(error.message || 'Error al enviar credenciales');
        } finally {
            setIsSendingCredentials(false);
        }
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

            // After successful update, remove any files that were present in the
            // previous policy but are no longer referenced in the updated policy.
            try {
                const oldFiles: string[] = [];
                if (editingPolicy.archivo_urls && Array.isArray(editingPolicy.archivo_urls)) {
                    oldFiles.push(...editingPolicy.archivo_urls);
                }
                if (editingPolicy.archivo_url) oldFiles.push(editingPolicy.archivo_url);

                const newFiles: string[] = [];
                if (updatedPolicy.archivo_urls && Array.isArray(updatedPolicy.archivo_urls)) {
                    newFiles.push(...updatedPolicy.archivo_urls);
                }
                if (updatedPolicy.archivo_url) newFiles.push(updatedPolicy.archivo_url);

                const filesToRemove = oldFiles.filter((f) => !newFiles.includes(f));
                if (filesToRemove.length > 0) {
                    console.log('Removing old files from storage after update:', filesToRemove);
                    await deleteFilesFromStorage(filesToRemove);
                }
            } catch (err) {
                console.error('Error deleting old files after update:', err);
            }
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

    // Helper to check if a file exists in storage. Uses listing of the parent
    // directory and checks filename presence to avoid downloading the file.
    const checkFileExistsInStorage = async (fileUrl: string) => {
        try {
            const cleanUrl = fileUrl.split('?')[0];

            // extract path inside bucket using same logic as delete helper
            const match = cleanUrl.match(/\/policy-documents\/(.*)$/);
            let filePath = null;
            if (match && match[1]) filePath = decodeURIComponent(match[1]);
            else {
                const altMatch = cleanUrl.match(/\/storage\/v\d+\/object\/public\/([^\/]+)\/(.*)$/);
                if (altMatch && altMatch[2]) filePath = decodeURIComponent(altMatch[2]);
            }

            if (!filePath) {
                const parts = cleanUrl.split('/');
                const idx = parts.findIndex(p => p === 'policy-documents');
                if (idx !== -1) filePath = parts.slice(idx + 1).join('/');
            }

            // Valor guardado por la carga masiva: ya es la ruta dentro del
            // bucket, sin el prefijo /policy-documents/ que buscan los patrones
            // de arriba. Sin esto la validación siempre daba "no existe".
            if (!filePath && !/^https?:\/\//i.test(cleanUrl)) {
                filePath = decodeURIComponent(cleanUrl.replace(/^\/+/, ''));
            }

            if (!filePath) return false;

            const parts = filePath.split('/');
            const fileName = parts.pop() as string;
            const dir = parts.join('/');

            const { data: listData, error: listError } = await supabase.storage
                .from('policy-documents')
                .list(dir || '', { limit: 1000 });

            if (listError) {
                console.error('Error listing storage path for existence check:', listError);
                return false;
            }

            if (!listData) return false;

            return listData.some(item => item.name === fileName);
        } catch (err) {
            console.error('Error checking file existence:', err);
            return false;
        }
    };

    // Validate files for all policies in `policies` and populate `validatedFiles`.
    // This runs whenever `policies` changes.
    useEffect(() => {
        let mounted = true;

        const validateAll = async () => {
            const map: Record<string, string[]> = {};

            await Promise.all(policies.map(async (policy) => {
                // Match renderPolicyFiles behavior: prefer archivo_urls when present.
                const files: string[] = [];
                if (policy.archivo_urls && Array.isArray(policy.archivo_urls) && policy.archivo_urls.length > 0) {
                    files.push(...policy.archivo_urls);
                } else if (policy.archivo_url) {
                    files.push(policy.archivo_url);
                }

                const valid: string[] = [];
                console.log('Validating files for policy', policy.id, 'candidates:', files);
                await Promise.all(files.map(async (url) => {
                    try {
                        const exists = await checkFileExistsInStorage(url);
                        console.log('  exists?', exists, url);
                        if (exists) valid.push(url);
                    } catch (e) {
                        console.error('validate file error', e);
                    }
                }));

                map[policy.id] = valid;
            }));

            if (mounted) setValidatedFiles(map);
        };

        validateAll();

        return () => { mounted = false; };
    }, [policies]);

    const deleteFilesFromStorage = async (urls: string[]) => {
        const extractFilePathFromUrl = (url: string) => {
            try {
                // Strip query params
                const cleanUrl = url.split('?')[0];

                // Try to capture after /policy-documents/
                const match = cleanUrl.match(/\/policy-documents\/(.*)$/);
                if (match && match[1]) return decodeURIComponent(match[1]);

                // Try Supabase public URL pattern: /storage/v1/object/public/<bucket>/<path>
                const altMatch = cleanUrl.match(/\/storage\/v\d+\/object\/public\/([^\/]+)\/(.*)$/);
                if (altMatch && altMatch[2]) return decodeURIComponent(altMatch[2]);

                // Fallback: locate the bucket segment and take the rest
                const urlParts = cleanUrl.split('/');
                const bucketIndex = urlParts.findIndex(part => part === 'policy-documents');
                if (bucketIndex === -1) return null;

                return urlParts.slice(bucketIndex + 1).join('/');
            } catch (error) {
                console.error('Error extracting file path from URL:', error);
                return null;
            }
        };

        const deletePromises = urls.map(async (url) => {
            try {
                const filePath = extractFilePathFromUrl(url);
                if (!filePath) {
                    console.warn("Could not determine file path from URL:", url);
                    return;
                }

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

            // Delete files from storage first (so we don't orphan files when DB delete succeeds)
            if (filesToDelete.length > 0) {
                console.log("Deleting files from storage...");
                await deleteFilesFromStorage(filesToDelete);
            }

            // Then delete policy from database
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

    const getWhatsAppLink = (telefono: string | null) => {
        if (!telefono) return null;
        const digits = telefono.replace(/\D/g, "");
        if (!digits) return null;
        const phone = digits.startsWith("598") ? digits : digits.startsWith("0") ? "598" + digits.slice(1) : "598" + digits;
        return `https://wa.me/${phone}`;
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
        // Prefer the explicit array of files (`archivo_urls`) when present.
        // Only fall back to the single `archivo_url` if `archivo_urls` is empty.
        const files: string[] = [];

        if (policy.archivo_urls && Array.isArray(policy.archivo_urls) && policy.archivo_urls.length > 0) {
            files.push(...policy.archivo_urls);
        } else if (policy.archivo_url) {
            files.push(policy.archivo_url);
        }

        // If validation has already run for this policy (key exists in the
        // map), use the validated result (even if empty). If validation has
        // not yet run (undefined), fall back to showing the raw `files`.
        const hasValidationRun = Object.prototype.hasOwnProperty.call(validatedFiles, policy.id);
        const validated = validatedFiles[policy.id];
        // If validation failed or returned empty (e.g. lack of Storage list perms),
        // fall back to the raw file list so the attachment is still visible.
        const toShow = hasValidationRun
            ? (validated && validated.length > 0 ? validated : files)
            : files;

        if (!toShow || toShow.length === 0) {
            return <span className="text-[10px] text-muted-foreground">N/A</span>;
        }

        // Deduplicate URLs
        const unique = Array.from(new Set(toShow));

        return (
            <div className="flex flex-wrap items-center justify-center gap-1">
                {unique.map((url, index) => (
                    <a
                        key={url}
                        href={resolvePolicyFileUrl(url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-md border border-primary/50 bg-primary/15 px-1 text-[9px] font-semibold text-foreground hover:bg-primary/25"
                        title={`Abrir documento ${index + 1}`}
                    >
                        <ExternalLink className="h-2.5 w-2.5" />
                        {unique.length > 1 && index + 1}
                    </a>
                ))}
            </div>
        );
    };

    const formatPolicyDate = (dateString: string) => {
        const [year, month, day] = dateString.split('T')[0].split('-');
        return year && month && day ? `${day}/${month}/${year}` : dateString;
    };

    const clientInitials = client.nombre
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();

    const policiesWithAmount = policies.filter((policy) => policy.prima_monto != null);
    const totalPremiumUYU = policiesWithAmount
        .filter((policy) => (policy.moneda || 'UYU') === 'UYU')
        .reduce((total, policy) => total + Number(policy.prima_monto), 0);
    const totalPremiumUSD = policiesWithAmount
        .filter((policy) => policy.moneda === 'USD')
        .reduce((total, policy) => total + Number(policy.prima_monto), 0);

    return (
        <div className="space-y-4">
            {/* Client Details Card */}
            <Card className="relative overflow-hidden border-border/80 bg-card/80 shadow-sm">
                <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
                <CardHeader className="border-b border-border/70 bg-muted/10 px-4 py-3.5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 text-sm font-bold text-foreground">
                                {clientInitials || <User className="h-6 w-6" />}
                            </div>
                            <div className="min-w-0">
                                <CardDescription className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-primary">
                                    Perfil del cliente
                                </CardDescription>
                                <CardTitle className="truncate text-lg font-bold uppercase tracking-tight sm:text-xl" title={client.nombre}>
                                    {client.nombre}
                                </CardTitle>
                                <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-border/80 bg-background/60 px-2 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">
                                    <Hash className="h-3 w-3 text-primary" />
                                    Cliente {client.numero_cliente || 'N/A'}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                            {client.telefono && getWhatsAppLink(client.telefono) && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => window.open(getWhatsAppLink(client.telefono)!, '_blank')}
                                    className="h-9 w-9 border-primary/50 text-primary hover:bg-primary/10"
                                    title="Abrir WhatsApp"
                                >
                                    <MessageCircle className="h-4 w-4" />
                                </Button>
                            )}
                            {hasAccount && client.email && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setIsSendCredentialsOpen(true)}
                                    className="h-9 w-9"
                                    title="Enviar credenciales de acceso"
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            )}
                            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setIsEditModalOpen(true)} title="Editar cliente">
                                <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog open={isDeleteClientDialogOpen} onOpenChange={setIsDeleteClientDialogOpen}>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon" className="h-9 w-9" title="Eliminar cliente">
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
                    </div>
                </CardHeader>
                <CardContent className="grid gap-2.5 p-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1.6fr_1fr]">
                    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border/70 bg-background/35 p-2.5">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                            <Mail className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</p>
                            <p className="truncate text-sm font-semibold normal-case" title={client.email}>{client.email || 'SIN EMAIL'}</p>
                        </div>
                    </div>
                    {client.telefono && (
                        <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border/70 bg-background/35 p-2.5">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                                <Phone className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Teléfono</p>
                                <a
                                    href={getWhatsAppLink(client.telefono) || undefined}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="truncate text-sm font-semibold hover:text-primary"
                                >
                                    {client.telefono}
                                </a>
                            </div>
                        </div>
                    )}
                    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border/70 bg-background/35 p-2.5">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                            <IdCard className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Documento</p>
                            <p className="truncate text-sm font-semibold">{client.documento || 'N/A'}</p>
                        </div>
                    </div>
                    {client.direccion && (
                        <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border/70 bg-background/35 p-2.5">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                                <MapPin className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dirección</p>
                                <p className="truncate text-sm font-semibold uppercase" title={client.direccion}>{client.direccion}</p>
                            </div>
                        </div>
                    )}
                    {client.departamento && (
                        <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border/70 bg-background/35 p-2.5">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                                <Building2 className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Departamento</p>
                                <p className="truncate text-sm font-semibold uppercase">{client.departamento}</p>
                            </div>
                        </div>
                    )}
                    {policiesWithAmount.length > 0 && (
                        <div className="col-span-full grid gap-2 border-t border-border/70 pt-2.5 sm:grid-cols-3">
                            <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Prima total UYU</span>
                                <strong className="text-sm">{totalPremiumUYU.toLocaleString('es-UY', { minimumFractionDigits: 2 })}</strong>
                            </div>
                            {totalPremiumUSD > 0 && (
                                <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">Prima total USD</span>
                                    <strong className="text-sm">{totalPremiumUSD.toLocaleString('es-UY', { minimumFractionDigits: 2 })}</strong>
                                </div>
                            )}
                            <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Pólizas con monto</span>
                                <strong className="text-sm">{policiesWithAmount.length} / {policies.length}</strong>
                            </div>
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

            {/* Search Filter */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por número de póliza, aseguradora, tipo, teléfono, notas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <div className="flex flex-shrink-0 justify-end gap-2">
                <MultiFilePolicyUploader
                    clientId={client.id}
                    companies={companies}
                    onUploadComplete={() => {
                        fetchPolicies();
                    }}
                    trigger={
                        <Button className="gap-2 font-semibold shadow-sm">
                            <Sparkles className="h-4 w-4" />
                            Cargar Pólizas con IA
                        </Button>
                    }
                />
                <div>
                    {isMobile ? (
                        <Drawer open={isFormOpen} onOpenChange={setIsFormOpen}>
                            <DrawerTrigger asChild>
                                <Button variant="outline">Cargar Póliza Manual</Button>
                            </DrawerTrigger>
                            <DrawerContent className="h-[95vh]">
                                <DrawerHeader className="text-left">
                                    <DrawerTitle>Cargar Póliza Manual</DrawerTitle>
                                    <DrawerDescription>Ingresa los detalles de la nueva póliza para {client.nombre}.</DrawerDescription>
                                </DrawerHeader>
                                <div className="px-4 pb-4 overflow-y-auto flex-1">
                                    <PolicyForm clients={[{ id: client.id, nombre: client.nombre }]} companies={companies} onSubmit={handleCreatePolicy} />
                                </div>
                            </DrawerContent>
                        </Drawer>
                    ) : (
                        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline">Cargar Póliza Manual</Button>
                            </DialogTrigger>
                            <DialogContent className="w-[calc(100vw-1rem)] max-h-[96vh] gap-3 overflow-hidden p-4 sm:max-w-[1280px]">
                                <DialogHeader>
                                    <DialogTitle>Cargar Póliza Manual</DialogTitle>
                                    <DialogDescription>Ingresa los detalles de la nueva póliza para {client.nombre}.</DialogDescription>
                                </DialogHeader>
                                <PolicyForm clients={[{ id: client.id, nombre: client.nombre }]} companies={companies} onSubmit={handleCreatePolicy} />
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>
            </div>

            <Card className="gap-4 py-4 uppercase">
                <CardHeader className="px-4">
                    <CardTitle className="text-sm">
                        Pólizas ({filteredPolicies.length}{filteredPolicies.length !== policies.length ? ` de ${policies.length}` : ''})
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-4">
                    {filteredPolicies.length === 0 ? (
                        <p>{policies.length === 0 ? "No hay pólizas registradas para este cliente." : "No se encontraron pólizas que coincidan con la búsqueda."}</p>
                    ) : (
                        <>
                          {/* Mobile View - Cards */}
                          <div className="space-y-2 md:hidden">
                            {filteredPolicies.map((policy) => (
                              <div key={policy.id} className="rounded-lg border p-3 space-y-2">
                                <div className="flex justify-between items-start gap-2">
                                  <div>
                                    <p className="text-xs text-muted-foreground font-semibold">Póliza</p>
                                    <p className="font-bold text-sm">{policy.numero_poliza}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-xs text-muted-foreground font-semibold">Vence</p>
                                    <p className="text-sm font-medium text-red-400">{formatPolicyDate(policy.vigencia_fin)}</p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <p className="text-muted-foreground font-semibold mb-1">Aseguradora</p>
                                    <p className="truncate">{policy.companies?.name || "N/A"}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground font-semibold mb-1">Tipo</p>
                                    <p className="truncate">{policy.tipo}</p>
                                  </div>
                                </div>

                                {policy.prima_monto != null && (
                                  <div className="text-sm">
                                    <p className="text-xs text-muted-foreground font-semibold mb-1">Prima</p>
                                    <p className="font-medium">
                                      {policy.moneda || 'UYU'} {Number(policy.prima_monto).toLocaleString('es-UY', { minimumFractionDigits: 0 })}
                                    </p>
                                  </div>
                                )}

                                {policy.notas && (
                                  <div className="text-xs pt-1 border-t">
                                    <p className="text-muted-foreground font-semibold mb-1">Notas</p>
                                    <p className="text-foreground/80">{policy.notas}</p>
                                  </div>
                                )}

                                <div className="flex gap-1 pt-1 border-t flex-wrap">
                                  <PolicyOcrUpdateDialog
                                    policy={policy}
                                    companies={companies}
                                    onSuccess={fetchPolicies}
                                  />
                                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => openEditForm(policy)}>
                                    <Edit className="h-3 w-3 mr-1" />
                                    Editar
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => openDeleteDialog(policy)}
                                    disabled={isDeleting}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>

                                <div className="pt-1 border-t">
                                  {renderPolicyFiles(policy)}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Desktop View - Table */}
                          <div className="hidden md:block overflow-hidden rounded-md border border-border/70">
                            <Table className="text-xs">
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead className="w-[10%] px-2 text-center text-xs">Póliza</TableHead>
                                  <TableHead className="w-[20%] border-l border-dashed border-border px-2 text-xs">Notas</TableHead>
                                  <TableHead className="w-[10%] border-l border-dashed border-border px-1 text-center text-xs">Aseguradora</TableHead>
                                  <TableHead className="w-[10%] border-l border-dashed border-border px-1 text-center text-xs">Tipo</TableHead>
                                  <TableHead className="w-[12%] border-l border-dashed border-border px-1 text-center text-xs">Prima</TableHead>
                                  <TableHead className="w-[10%] border-l border-dashed border-border px-1 text-center text-xs">Inicio</TableHead>
                                  <TableHead className="w-[10%] border-l border-dashed border-border px-1 text-center text-xs">Fin</TableHead>
                                  <TableHead className="w-[8%] border-l border-dashed border-border px-1 text-center text-xs">Doc</TableHead>
                                  <TableHead className="w-[10%] border-l border-dashed border-border px-1 text-center text-xs">Acciones</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredPolicies.map((policy) => (
                                  <TableRow key={policy.id}>
                                    <TableCell className="truncate px-2 text-center font-bold">{policy.numero_poliza}</TableCell>
                                    <TableCell className="border-l border-dashed border-border px-2 text-left">
                                      <span className="block truncate text-xs font-medium text-foreground/80" title={policy.notas || "SIN NOTAS"}>
                                        {policy.notas || "N/A"}
                                      </span>
                                    </TableCell>
                                    <TableCell className="border-l border-dashed border-border px-1 text-center">
                                      <span className="inline-flex max-w-full truncate rounded-md border border-border/80 bg-muted/40 px-1.5 py-1 font-semibold text-xs">
                                        {policy.companies?.name || "N/A"}
                                      </span>
                                    </TableCell>
                                    <TableCell className="border-l border-dashed border-border px-1 text-center">
                                      <span className="inline-flex max-w-full truncate rounded-md border border-border/80 bg-muted/40 px-1.5 py-1 font-semibold text-xs" title={policy.tipo}>
                                        {policy.tipo}
                                      </span>
                                    </TableCell>
                                    <TableCell className="border-l border-dashed border-border px-1 text-center">
                                      {policy.prima_monto != null ? (
                                        <span className="inline-flex max-w-full flex-col rounded-md border border-border/80 bg-muted/40 px-1.5 py-1 font-semibold leading-tight text-xs">
                                          {policy.moneda || 'UYU'} {Number(policy.prima_monto).toLocaleString('es-UY', { minimumFractionDigits: 0 })}
                                        </span>
                                      ) : <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                    <TableCell className="border-l border-dashed border-border px-1 text-center">
                                      <span className="inline-flex rounded-md border border-green-500/45 bg-green-500/15 px-1.5 py-1 text-xs font-semibold text-green-400">
                                        {formatPolicyDate(policy.vigencia_inicio)}
                                      </span>
                                    </TableCell>
                                    <TableCell className="border-l border-dashed border-border px-1 text-center">
                                      <span className="inline-flex rounded-md border border-red-500/45 bg-red-500/15 px-1.5 py-1 text-xs font-semibold text-red-400">
                                        {formatPolicyDate(policy.vigencia_fin)}
                                      </span>
                                    </TableCell>
                                    <TableCell className="border-l border-dashed border-border px-1 text-center">
                                      {renderPolicyFiles(policy)}
                                    </TableCell>
                                    <TableCell className="border-l border-dashed border-border px-1">
                                      <div className="flex items-center justify-center gap-1">
                                        <PolicyOcrUpdateDialog
                                          policy={policy}
                                          companies={companies}
                                          onSuccess={fetchPolicies}
                                        />
                                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => openEditForm(policy)} title="Editar">
                                          <Edit className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          variant="destructive"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => openDeleteDialog(policy)}
                                          disabled={isDeleting}
                                          title="Eliminar"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Edit Policy Dialog/Drawer */}
            {isMobile ? (
                <Drawer open={isEditPolicyFormOpen} onOpenChange={setIsEditPolicyFormOpen}>
                    <DrawerContent className="h-[95vh]">
                        <DrawerHeader className="text-left">
                            <DrawerTitle>Editar Póliza</DrawerTitle>
                            <DrawerDescription>Actualiza los detalles de la póliza.</DrawerDescription>
                        </DrawerHeader>
                        <div className="px-4 pb-4 overflow-y-auto flex-1">
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
                    <DialogContent className="w-[calc(100vw-1rem)] max-h-[96vh] gap-3 overflow-hidden p-4 sm:max-w-[1280px]">
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

            {/* Send Credentials Dialog */}
            <Dialog open={isSendCredentialsOpen} onOpenChange={setIsSendCredentialsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Enviar Credenciales de Acceso</DialogTitle>
                        <DialogDescription>
                            Se generará una nueva contraseña temporal y se enviará al email indicado. El usuario deberá cambiarla en su próximo inicio de sesión.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-medium">Email</label>
                            <Input
                                value={credentialsEmail}
                                onChange={(e) => setCredentialsEmail(e.target.value)}
                                placeholder="Email del cliente"
                                type="email"
                                className="mt-2"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsSendCredentialsOpen(false);
                                setCredentialsEmail(client.email);
                                setSentTempPassword(null);
                            }}
                            disabled={isSendingCredentials}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleSendCredentials}
                            disabled={isSendingCredentials || !credentialsEmail}
                        >
                            {isSendingCredentials ? "Enviando..." : "Enviar"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
