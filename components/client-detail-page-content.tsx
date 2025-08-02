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
import { Mail, Phone, FileText, User, CalendarDays } from "lucide-react";

interface Client {
    id: string;
    nombre: string;
    email: string;
    telefono: string | null;
    documento: string;
    direccion: string | null;
    created_at: string;
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
    const isMobile = useIsMobile();
    const supabase = createClient();

    const handleCreatePolicy = async (policyData: any) => {
        try {
            const newPolicyData = { ...policyData, client_id: client.id };
            const { data, error } = await supabase.from("policies").insert([newPolicyData]).select("*, companies(name)").single();
            if (error) {
                throw error;
            }
            setPolicies((prev) => [...prev, data as Policy]);
            setIsFormOpen(false);
            alert("Póliza creada exitosamente!");
        } catch (err: any) {
            alert(`Error al crear la póliza: ${err.message}`);
        }
    };

    return (
        <div className="space-y-6">
            {/* Client Details Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl flex items-center">
                        <User className="h-6 w-6 mr-2" />
                        {client.nombre}
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
                </CardContent>
            </Card>

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
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
