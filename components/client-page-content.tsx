"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, User, Mail, Phone, FileText } from "lucide-react"
import { CreateClientDialog } from "@/components/create-client-dialog"
import Link from "next/link"

interface Client {
    id: string
    nombre: string
    email: string
    telefono: string | null
    documento: string
    direccion: string | null
    created_at: string
    policies?: { count: number }[]
}

interface ClientPageContentProps {
    initialClients: Client[]
}

export function ClientPageContent({ initialClients }: ClientPageContentProps) {
    const [clients, setClients] = useState<Client[]>(initialClients)
    const [searchTerm, setSearchTerm] = useState("")
    const [showCreateDialog, setShowCreateDialog] = useState(false)

    const fetchClients = async () => {
        // This function can be improved to re-fetch from the server
        // For now, it will just re-set the initial clients
        setClients(initialClients)
    }

    const filteredClients = clients.filter(
        (client) =>
            client.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.documento.includes(searchTerm),
    )

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Gestión de Clientes</h1>
                    <p className="text-muted-foreground">Administra todos los clientes del sistema</p>
                </div>
                <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Cliente
                </Button>
            </div>

            <div className="flex items-center space-x-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre, email o documento..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredClients.map((client) => (
                    <Card key={client.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg flex items-center">
                                    <User className="h-5 w-5 mr-2" />
                                    {client.nombre}
                                </CardTitle>
                                <Badge variant="secondary">{client.policies?.[0]?.count || 0} pólizas</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <div className="flex items-center text-sm text-muted-foreground">
                                <Mail className="h-4 w-4 mr-2" />
                                {client.email}
                            </div>
                            {client.telefono && (
                                <div className="flex items-center text-sm text-muted-foreground">
                                    <Phone className="h-4 w-4 mr-2" />
                                    {client.telefono}
                                </div>
                            )}
                            <div className="flex items-center text-sm text-muted-foreground">
                                <FileText className="h-4 w-4 mr-2" />
                                Doc: {client.documento}
                            </div>
                            <div className="pt-2">
                                <Link href={`/admin/clientes/${client.id}`}>
                                    <Button variant="outline" size="sm" className="w-full bg-transparent">
                                        Ver Detalles
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {filteredClients.length === 0 && (
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

            <CreateClientDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onClientCreated={fetchClients} />
        </div>
    )
}
