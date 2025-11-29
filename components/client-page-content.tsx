"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Search, User, Trash2, RefreshCw } from "lucide-react"
import { CreateClientDialog } from "@/components/create-client-dialog"
import Link from "next/link"
import { toast } from "sonner"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface Client {
    id: string
    nombre: string
    email: string
    telefono: string | null
    documento: string
    direccion: string | null
    created_at: string
    numero_cliente: number | null
    departamento: string | null
    policies?: { count: number }[]
}

interface ClientPageContentProps {
    initialClients: Client[]
    onClientsUpdate: () => void
}

export function ClientPageContent({ initialClients, onClientsUpdate }: ClientPageContentProps) {
    const [clients, setClients] = useState<Client[]>(initialClients)
    const [searchTerm, setSearchTerm] = useState("")
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [isSearching, setIsSearching] = useState(false)
    const itemsPerPage = 25

    useEffect(() => {
        setClients(initialClients)
        setCurrentPage(1)
    }, [initialClients])

    // Función de búsqueda mejorada
    const fuzzyMatch = (text: string, search: string): boolean => {
        if (!text) return false;
        
        text = text.toLowerCase();
        search = search.toLowerCase();
        
        // Coincidencia exacta o incluye (más estricto)
        if (text.includes(search)) return true;
        
        // Buscar cada palabra del término de búsqueda
        const searchWords = search.split(/\s+/).filter(w => w.length > 0);
        const textWords = text.split(/\s+/).filter(w => w.length > 0);
        
        // Si todas las palabras de búsqueda están contenidas en alguna palabra del texto
        const allWordsMatch = searchWords.every(searchWord => 
            textWords.some(textWord => textWord.includes(searchWord))
        );
        
        if (allWordsMatch) return true;
        
        // Búsqueda por iniciales solo si son 2-3 letras y sin espacios
        if (search.length >= 2 && search.length <= 3 && !search.includes(' ')) {
            const initials = textWords.map(w => w[0]).join('');
            if (initials === search || initials.startsWith(search)) return true;
        }
        
        return false;
    };

    const filteredClients = clients.filter((client) => {
        const trimmedSearch = searchTerm.trim();
        if (trimmedSearch === "") return true;
        
        const searchLower = trimmedSearch.toLowerCase();
        
        // Si el término es solo números, buscar SOLO por número de cliente (exacto)
        if (/^\d+$/.test(trimmedSearch)) {
            return client.numero_cliente && client.numero_cliente.toString() === trimmedSearch;
        }
        
        // Si contiene letras, buscar en todos los campos de texto con fuzzy matching
        return (
            fuzzyMatch(client.nombre, searchLower) ||
            fuzzyMatch(client.email || '', searchLower) ||
            fuzzyMatch(client.documento, searchLower) ||
            (client.telefono && client.telefono.includes(trimmedSearch)) ||
            fuzzyMatch(client.departamento || '', searchLower) ||
            fuzzyMatch(client.direccion || '', searchLower)
        );
    });

    const handleDeleteClient = useCallback(async (client: Client) => {
        try {
            const response = await fetch(`/api/clients/${client.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al eliminar el cliente');
            }

            onClientsUpdate() // Refrescar la lista de clientes
            toast.success('Cliente eliminado exitosamente');
        } catch (error: any) {
            toast.error(error.message);
        }
    }, [onClientsUpdate]);

    const totalPages = Math.ceil(filteredClients.length / itemsPerPage)
    const paginatedClients = filteredClients.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
    )

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Gestión de Clientes</h1>
                    <p className="text-muted-foreground">Administra todos los clientes del sistema</p>
                </div>
                <div className="flex items-center gap-2">
                    
                    <Button onClick={() => setShowCreateDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar Cliente
                    </Button>
                </div>
            </div>

            <div className="flex items-center space-x-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre, email, documento, teléfono o número de cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>N° Cliente</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Documento</TableHead>
                            <TableHead>Teléfono</TableHead>
                            <TableHead>Pólizas</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedClients.map((client) => (
                            <TableRow key={client.id}>
                                <TableCell className="font-semibold text-primary">
                                    #{client.numero_cliente || 'N/A'}
                                </TableCell>
                                <TableCell className="font-medium">{client.nombre}</TableCell>
                                <TableCell>{client.email || "Sin email"}</TableCell>
                                <TableCell>{client.documento}</TableCell>
                                <TableCell>{client.telefono || "N/A"}</TableCell>
                                <TableCell>{client.policies?.[0]?.count || 0}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end items-center gap-2">
                                        <Link href={`/admin/clientes/${client.id}`}>
                                            <Button variant="outline" size="sm">
                                                Ver Detalles
                                            </Button>
                                        </Link>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="sm">
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
                                                    <AlertDialogAction onClick={() => handleDeleteClient(client)}>
                                                        Eliminar Cliente
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Pagination>
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                                e.preventDefault()
                                if (currentPage > 1) setCurrentPage(currentPage - 1)
                            }}
                        />
                    </PaginationItem>
                    {[...Array(totalPages)].map((_, i) => (
                        <PaginationItem key={i}>
                            <PaginationLink
                                href="#"
                                isActive={currentPage === i + 1}
                                onClick={(e) => {
                                    e.preventDefault()
                                    setCurrentPage(i + 1)
                                }}
                            >
                                {i + 1}
                            </PaginationLink>
                        </PaginationItem>
                    ))}
                    <PaginationItem>
                        <PaginationNext
                            href="#"
                            onClick={(e) => {
                                e.preventDefault()
                                if (currentPage < totalPages) setCurrentPage(currentPage + 1)
                            }}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>

            {paginatedClients.length === 0 && (
                <Card>
                    <CardContent className="text-center py-8">
                        <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No se encontraron clientes</h3>
                        <p className="text-muted-foreground mb-4">
                            {searchTerm ? "Intenta con otros términos de búsqueda" : "Comienza agregando tu primer cliente"}
                        </p>
                        {!searchTerm && (
                            <Button onClick={() => setShowCreateDialog(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Agregar Cliente
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            <CreateClientDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onClientCreated={onClientsUpdate} />
        </div>
    )
}
