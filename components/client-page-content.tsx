"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Search, User, Trash2, RefreshCw, Smartphone, Mail, Copy, Check, IdCard, X } from "lucide-react"
import { CreateClientDialog } from "@/components/create-client-dialog"
import Link from "next/link"
import { toast } from "sonner"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
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
  PaginationEllipsis,
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
    const [copiedValueKey, setCopiedValueKey] = useState<string | null>(null)
    const [isSearchFocused, setIsSearchFocused] = useState(false)
    const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1)
    const [topbarActionsContainer, setTopbarActionsContainer] = useState<HTMLElement | null>(null)
    const itemsPerPage = 25

    useEffect(() => {
        setClients(initialClients)
        setCurrentPage(1)
    }, [initialClients])

    useEffect(() => {
        setTopbarActionsContainer(document.getElementById("admin-topbar-actions"))
    }, [])

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

    const normalizedSuggestionSearch = searchTerm.trim().toLowerCase()
    const searchSuggestions = normalizedSuggestionSearch
        ? clients
            .filter((client) =>
                [
                    client.nombre,
                    client.email,
                    client.documento,
                    client.numero_cliente?.toString(),
                ].some((value) => value?.toLowerCase().includes(normalizedSuggestionSearch)),
            )
            .slice(0, 6)
        : []

    const selectSearchSuggestion = (client: Client) => {
        setSearchTerm(client.nombre.toUpperCase())
        setCurrentPage(1)
        setHighlightedSuggestion(-1)
        setIsSearchFocused(false)
    }

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

    const handleCopyValue = async (value: string, key: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value)
            setCopiedValueKey(key)
            toast.success(`${label} copiado`)
            window.setTimeout(() => setCopiedValueKey(null), 2000)
        } catch {
            toast.error(`No se pudo copiar el ${label.toLowerCase()}`)
        }
    }

    const totalPages = Math.ceil(filteredClients.length / itemsPerPage)
    const pageGroupStart = Math.floor((currentPage - 1) / 5) * 5 + 1
    const pageGroupEnd = Math.min(pageGroupStart + 4, totalPages)
    const visiblePages = Array.from(
        { length: Math.max(0, pageGroupEnd - pageGroupStart + 1) },
        (_, index) => pageGroupStart + index,
    )
    const paginatedClients = filteredClients.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
    )

    return (
        <div className="space-y-6">
            {topbarActionsContainer && createPortal(
            <div className="flex w-full items-center gap-3">
                <div className="group relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors duration-200 group-focus-within:text-primary" />
                    <Input
                        placeholder="Buscar por nombre, email, documento, teléfono o número de cliente..."
                        value={searchTerm}
                        aria-label="Buscar clientes"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={isSearchFocused && searchSuggestions.length > 0}
                        aria-controls="client-search-suggestions"
                        aria-activedescendant={
                            highlightedSuggestion >= 0
                                ? `client-suggestion-${searchSuggestions[highlightedSuggestion]?.id}`
                                : undefined
                        }
                        autoComplete="off"
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setIsSearchFocused(false)}
                        onChange={(e) => {
                            setSearchTerm(e.target.value.toUpperCase())
                            setCurrentPage(1)
                            setHighlightedSuggestion(-1)
                            setIsSearchFocused(true)
                        }}
                        onKeyDown={(e) => {
                            if (!searchSuggestions.length) return

                            if (e.key === "ArrowDown") {
                                e.preventDefault()
                                setHighlightedSuggestion((current) =>
                                    Math.min(current + 1, searchSuggestions.length - 1),
                                )
                            } else if (e.key === "ArrowUp") {
                                e.preventDefault()
                                setHighlightedSuggestion((current) => Math.max(current - 1, 0))
                            } else if (e.key === "Enter" && highlightedSuggestion >= 0) {
                                e.preventDefault()
                                selectSearchSuggestion(searchSuggestions[highlightedSuggestion])
                            } else if (e.key === "Escape") {
                                setIsSearchFocused(false)
                                setHighlightedSuggestion(-1)
                            }
                        }}
                        className="h-14 w-full rounded-xl border-border/60 bg-card/50 pl-12 pr-12 text-lg font-semibold uppercase tracking-wide shadow-sm transition-all duration-200 placeholder:text-base placeholder:font-medium placeholder:tracking-normal placeholder:text-muted-foreground/70 hover:border-border focus-visible:border-primary/50 focus-visible:bg-background focus-visible:ring-4 focus-visible:ring-primary/10 md:text-lg"
                    />
                    {searchTerm && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Limpiar búsqueda"
                            className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            onClick={() => {
                                setSearchTerm("")
                                setCurrentPage(1)
                                setHighlightedSuggestion(-1)
                            }}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                    {isSearchFocused && searchSuggestions.length > 0 && (
                        <div
                            id="client-search-suggestions"
                            role="listbox"
                            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border/70 bg-popover p-1.5 shadow-xl"
                        >
                            <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Sugerencias
                            </p>
                            {searchSuggestions.map((client, index) => (
                                <button
                                    key={client.id}
                                    id={`client-suggestion-${client.id}`}
                                    type="button"
                                    role="option"
                                    aria-selected={highlightedSuggestion === index}
                                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                                        highlightedSuggestion === index
                                            ? "bg-primary/10 text-primary"
                                            : "hover:bg-muted/70"
                                    }`}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        selectSearchSuggestion(client)
                                    }}
                                    onMouseEnter={() => setHighlightedSuggestion(index)}
                                >
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                        <User className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold uppercase">
                                            {client.nombre}
                                        </span>
                                        <span className="block truncate text-xs uppercase text-muted-foreground">
                                            #{client.numero_cliente || "N/A"} · {client.documento}
                                        </span>
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <Button
                    onClick={() => setShowCreateDialog(true)}
                    aria-label="Agregar cliente"
                    className="h-14 shrink-0 rounded-xl px-3 text-base font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:px-6"
                >
                    <Plus className="h-5 w-5" />
                    <span className="hidden sm:inline">Agregar Cliente</span>
                </Button>
            </div>,
            topbarActionsContainer,
            )}

            <div className="rounded-md border">
                <Table className="uppercase [&_th:not(:last-child)]:border-r [&_th:not(:last-child)]:border-dotted [&_th:not(:last-child)]:border-border/80 [&_td:not(:last-child)]:border-r [&_td:not(:last-child)]:border-dotted [&_td:not(:last-child)]:border-border/60">
                    <TableHeader>
                        <TableRow>
                            <TableHead>N° Cliente</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Documento</TableHead>
                            <TableHead>Teléfono</TableHead>
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
                                <TableCell>
                                    {client.email ? (
                                        <HoverCard openDelay={150} closeDelay={100}>
                                            <HoverCardTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    aria-label={`Ver email de ${client.nombre}`}
                                                    className="h-8 w-8 text-muted-foreground hover:border-primary/50 hover:text-primary"
                                                >
                                                    <Mail className="h-4 w-4" />
                                                </Button>
                                            </HoverCardTrigger>
                                            <HoverCardContent align="start" className="w-auto max-w-sm space-y-3 uppercase">
                                                <div>
                                                    <p className="text-xs font-medium text-muted-foreground">Email</p>
                                                    <p className="mt-1 break-all text-sm font-semibold">{client.email}</p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full"
                                                    onClick={() => handleCopyValue(client.email, `email-${client.id}`, "Email")}
                                                >
                                                    {copiedValueKey === `email-${client.id}` ? (
                                                        <>
                                                            <Check className="h-4 w-4 text-primary" />
                                                            Copiado
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="h-4 w-4" />
                                                            Copiar email
                                                        </>
                                                    )}
                                                </Button>
                                            </HoverCardContent>
                                        </HoverCard>
                                    ) : "Sin email"}
                                </TableCell>
                                <TableCell>
                                    <HoverCard openDelay={150} closeDelay={100}>
                                        <HoverCardTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                aria-label={`Ver documento de ${client.nombre}`}
                                                className="h-8 w-8 text-muted-foreground hover:border-primary/50 hover:text-primary"
                                            >
                                                <IdCard className="h-4 w-4" />
                                            </Button>
                                        </HoverCardTrigger>
                                        <HoverCardContent align="start" className="w-auto min-w-52 space-y-3 uppercase">
                                            <div>
                                                <p className="text-xs font-medium text-muted-foreground">Documento</p>
                                                <p className="mt-1 text-sm font-semibold">{client.documento}</p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="w-full"
                                                onClick={() => handleCopyValue(client.documento, `documento-${client.id}`, "Documento")}
                                            >
                                                {copiedValueKey === `documento-${client.id}` ? (
                                                    <>
                                                        <Check className="h-4 w-4 text-primary" />
                                                        Copiado
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="h-4 w-4" />
                                                        Copiar documento
                                                    </>
                                                )}
                                            </Button>
                                        </HoverCardContent>
                                    </HoverCard>
                                </TableCell>
                                <TableCell>
                                    {client.telefono ? (
                                        (() => {
                                            const digits = client.telefono.replace(/\D/g, "");
                                            const phone = digits.startsWith("598") ? digits : digits.startsWith("0") ? "598" + digits.slice(1) : "598" + digits;
                                            return phone ? (
                                                <a
                                                    href={`https://wa.me/${phone}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title="Abrir WhatsApp"
                                                    aria-label={`Abrir WhatsApp de ${client.nombre}`}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10 hover:text-primary"
                                                >
                                                    <Smartphone className="h-5 w-5" />
                                                </a>
                                            ) : null;
                                        })()
                                    ) : "N/A"}
                                </TableCell>
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

            {totalPages > 1 && (
                <Pagination className="py-1">
                    <PaginationContent className="gap-0.5">
                        <PaginationItem>
                            <PaginationPrevious
                                href="#"
                                aria-disabled={currentPage === 1}
                                className="h-7 w-7 p-0 [&_span]:hidden aria-disabled:pointer-events-none aria-disabled:opacity-40"
                                onClick={(e) => {
                                    e.preventDefault()
                                    if (currentPage > 1) setCurrentPage(currentPage - 1)
                                }}
                            />
                        </PaginationItem>
                        {pageGroupStart > 1 && (
                            <PaginationItem>
                                <PaginationEllipsis className="h-7 w-7" />
                            </PaginationItem>
                        )}
                        {visiblePages.map((page) => (
                            <PaginationItem key={page}>
                                <PaginationLink
                                    href="#"
                                    size="icon"
                                    className="h-7 w-7 text-xs"
                                    isActive={currentPage === page}
                                    onClick={(e) => {
                                        e.preventDefault()
                                        setCurrentPage(page)
                                    }}
                                >
                                    {page}
                                </PaginationLink>
                            </PaginationItem>
                        ))}
                        {pageGroupEnd < totalPages && (
                            <PaginationItem>
                                <PaginationEllipsis className="h-7 w-7" />
                            </PaginationItem>
                        )}
                        <PaginationItem>
                            <PaginationNext
                                href="#"
                                aria-disabled={currentPage === totalPages}
                                className="h-7 w-7 p-0 [&_span]:hidden aria-disabled:pointer-events-none aria-disabled:opacity-40"
                                onClick={(e) => {
                                    e.preventDefault()
                                    if (currentPage < totalPages) setCurrentPage(currentPage + 1)
                                }}
                            />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            )}

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
