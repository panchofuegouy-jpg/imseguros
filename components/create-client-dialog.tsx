"use client"

import * as React from "react"

import { useState } from "react"
// Removed direct import of createClientUser
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"

import { useEffect } from "react";

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientCreated?: () => void; // Optional for create mode
  onClientUpdated?: (data: any) => void; // Optional for edit mode
  client?: any; // Pass client data for editing
}

const departments = [
  "Artigas", "Canelones", "Cerro Largo", "Colonia", "Durazno",
  "Flores", "Florida", "Lavalleja", "Maldonado", "Montevideo",
  "Paysandú", "Río Negro", "Rivera", "Rocha", "Salto",
  "San José", "Soriano", "Tacuarembó", "Treinta y Tres"
];

export function CreateClientDialog({ open, onOpenChange, onClientCreated, onClientUpdated, client }: CreateClientDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState<{ client: any; password?: string; emailSent?: boolean } | null>(null)
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    telefono: "",
    documento: "",
    direccion: "",
    numero_cliente: "",
    departamento: "",
  })

  const isEditMode = !!client;

  useEffect(() => {
    if (isEditMode && client) {
      setFormData({
        nombre: client.nombre || "",
        email: client.email || "",
        telefono: client.telefono || "",
        documento: client.documento || "",
        direccion: client.direccion || "",
        numero_cliente: client.numero_cliente || "",
        departamento: client.departamento || "",
      });
    } else {
      // Reset form for create mode
      setFormData({
        nombre: "",
        email: "",
        telefono: "",
        documento: "",
        direccion: "",
        numero_cliente: "",
        departamento: "",
      });
    }
  }, [client, isEditMode, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess(null)

    try {
      let result;
      if (isEditMode) {
        // Update existing client
        const response = await fetch(`/api/clients/${client.id}`,
         {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Error al actualizar');
        setSuccess({ client: result });
        if(onClientUpdated) onClientUpdated(result);

      } else {
        // Create new client
        const response = await fetch('/api/create-client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Error al crear el cliente');
        setSuccess({ 
          client: result.client, 
          password: result.tempPassword,
          emailSent: result.emailSent || false
        });
        if(onClientCreated) onClientCreated();
      }

    } catch (error: any) {
      setError(error.message || "Ocurrió un error")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFormData({
      nombre: "",
      email: "",
      telefono: "",
      documento: "",
      direccion: "",
      numero_cliente: "",
      departamento: "",
    })
    setError("")
    setSuccess(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Nuevo Cliente</DialogTitle>
          <DialogDescription>
            Crea un nuevo cliente y genera automáticamente sus credenciales de acceso.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>Cliente creado exitosamente. Se ha generado una cuenta de acceso.</AlertDescription>
            </Alert>

            <div>
              <h4 className="font-semibold">Credenciales de acceso:</h4>
              <p>
                <strong>Email:</strong> {success.client.email}
              </p>
              <p>
                <strong>Contraseña temporal:</strong>{" "}
                <code className="px-2 py-1 rounded">{success.password}</code>
              </p>
              
              {success.emailSent ? (
                <Alert className="mt-3">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Email con credenciales enviado exitosamente a {success.client.email}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive" className="mt-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No se pudo enviar el email automáticamente. Comparte las credenciales manualmente.
                  </AlertDescription>
                </Alert>
              )}
              
              <p className="text-sm text-muted-foreground">
                {success.emailSent 
                  ? "El cliente recibirá un email con instrucciones para acceder."
                  : "Comparte estas credenciales con el cliente de forma segura."
                }
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre completo *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
                placeholder="Juan Pérez"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="juan@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="documento">Documento de identidad *</Label>
              <Input
                id="documento"
                value={formData.documento}
                onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                required
                placeholder="12345678"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                placeholder="+1234567890"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Textarea
                id="direccion"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                placeholder="Calle Principal 123, Ciudad"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numero_cliente">Número de Cliente</Label>
              <Input
                id="numero_cliente"
                type="number"
                value={formData.numero_cliente}
                onChange={(e) => setFormData({ ...formData, numero_cliente: e.target.value })}
                placeholder="123"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="departamento">Departamento</Label>
              <Select
                onValueChange={(value) => setFormData({ ...formData, departamento: value })}
                value={formData.departamento}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(dep => (
                    <SelectItem key={dep} value={dep}>{dep}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creando..." : "Crear Cliente"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {success && (
          <DialogFooter>
            <Button onClick={handleClose}>Cerrar</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
