"use client"

import React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Upload, FileText, X, User, Plus } from 'lucide-react'
import { createClient } from "@/lib/supabase/client"

interface PolicyFormProps {
  clients: Array<{ id: string; nombre: string }>
  companies: Array<{ id: string; name: string }>
  onSubmit: (policyData: any) => void
  initialData?: any
}

interface FileAttachment {
  id: string
  file?: File
  url?: string
  name: string
  size?: number
}

export default function PolicyForm({ clients, companies, onSubmit, initialData }: PolicyFormProps) {
  const [formData, setFormData] = useState({
    client_id: initialData?.client_id || "",
    company_id: initialData?.company_id || "",
    numero_poliza: initialData?.numero_poliza || "",
    tipo: initialData?.tipo || "",
    vigencia_inicio: initialData?.vigencia_inicio || "",
    vigencia_fin: initialData?.vigencia_fin || "",
    nombre_asegurado: initialData?.nombre_asegurado || "",
    documento_asegurado: initialData?.documento_asegurado || "",
    parentesco: initialData?.parentesco || "",
    notas: initialData?.notas || "",
  })

  const [fileAttachments, setFileAttachments] = useState<FileAttachment[]>(() => {
    if (initialData?.archivo_urls && Array.isArray(initialData.archivo_urls)) {
      return initialData.archivo_urls.map((url: string, index: number) => ({
        id: `existing-${index}`,
        url,
        name: `Archivo ${index + 1}`,
      }))
    }
    // Handle legacy single archivo_url
    if (initialData?.archivo_url) {
      return [{
        id: 'existing-0',
        url: initialData.archivo_url,
        name: 'Archivo existente',
      }]
    }
    return []
  })

  const [uploading, setUploading] = useState(false)
  const [useClientAsInsured, setUseClientAsInsured] = useState(
    initialData ? initialData.nombre_asegurado === "" : true
  )

  const supabase = createClient()

  // Obtener el nombre del cliente seleccionado
  const selectedClient = clients.find(client => client.id === formData.client_id)

  // Actualizar el nombre del asegurado automáticamente si está marcada la opción
  React.useEffect(() => {
    if (useClientAsInsured && selectedClient) {
      setFormData(prev => ({
        ...prev,
        nombre_asegurado: "",
        documento_asegurado: "",
        parentesco: "Titular"
      }))
    }
  }, [useClientAsInsured, selectedClient])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])

    selectedFiles.forEach(file => {
      // Validate file type (PDF, DOC, DOCX)
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]

      if (allowedTypes.includes(file.type)) {
        const newAttachment: FileAttachment = {
          id: `new-${Date.now()}-${Math.random()}`,
          file,
          name: file.name,
          size: file.size
        }

        setFileAttachments(prev => [...prev, newAttachment])
      } else {
        alert(`El archivo ${file.name} no es válido. Por favor selecciona archivos PDF, DOC o DOCX`)
      }
    })

    // Reset input
    event.target.value = ''
  }

  const uploadFile = async (file: File, policyId: string, clientId: string): Promise<string | null> => {
    console.log("PolicyForm: Attempting to upload file:", file.name, "for policy ID:", policyId, "and client ID:", clientId);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${policyId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `policies/${clientId}/${fileName}`;
      console.log("PolicyForm: File path for upload:", filePath);

      const { data, error } = await supabase.storage.from("policy-documents").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      })

      if (error) {
        console.error("PolicyForm: Error uploading file to Supabase Storage:", error)
        return null
      }
      console.log("PolicyForm: File uploaded successfully. Data:", data);

      const { data: publicUrlData } = supabase.storage.from("policy-documents").getPublicUrl(filePath)
      console.log("PolicyForm: Public URL data:", publicUrlData);

      return publicUrlData.publicUrl
    } catch (error) {
      console.error("PolicyForm: Unhandled error in uploadFile:", error)
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("PolicyForm: Form submitted. Current form data:", formData);
    console.log("PolicyForm: File attachments:", fileAttachments);

    try {
      setUploading(true)
      const archivo_urls: string[] = []

      // Upload new files and collect existing URLs
      for (const attachment of fileAttachments) {
        if (attachment.file) {
          // New file to upload
          console.log("PolicyForm: New file detected, attempting upload...");
          const tempPolicyId = initialData?.id || `temp-${Date.now()}`;
          const uploadedUrl = await uploadFile(attachment.file, tempPolicyId, formData.client_id);

          if (uploadedUrl) {
            archivo_urls.push(uploadedUrl);
          } else {
            alert(`Error al subir el archivo ${attachment.name}. Por favor, revisa la consola para más detalles.`);
            return;
          }
        } else if (attachment.url) {
          // Existing file URL
          archivo_urls.push(attachment.url);
        }
      }

      const policyData = {
        ...formData,
        archivo_urls,
        // Si useClientAsInsured es true, enviamos valores vacíos para que se use el cliente
        nombre_asegurado: useClientAsInsured ? "" : formData.nombre_asegurado,
        documento_asegurado: useClientAsInsured ? "" : formData.documento_asegurado,
        parentesco: useClientAsInsured ? "Titular" : formData.parentesco,
      }
      console.log("PolicyForm: Submitting policy data to parent component:", policyData);

      onSubmit(policyData)
    } catch (error) {
      console.error("PolicyForm: Error submitting form (PolicyForm):", error)
      alert("Error al guardar la póliza")
    } finally {
      setUploading(false)
    }
  }

  const removeFile = (fileId: string) => {
    setFileAttachments(prev => prev.filter(file => file.id !== fileId))
  }

  const formatFileSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  }

  return (
    <div className="min-h-screen bg-background p-4 lg:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
            {initialData ? "Editar Póliza" : "Nueva Póliza"}
          </h1>
          <p className="text-muted-foreground mt-3 text-lg">
            {initialData ? "Modifica los datos de la póliza existente" : "Completa la información para crear una nueva póliza"}
          </p>
        </div>

        <Card className="shadow-lg border bg-card">
          <CardContent className="p-8 lg:p-10">
            <form onSubmit={handleSubmit} className="space-y-10">
              {/* Información del Cliente y Aseguradora */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="w-2 h-8 bg-primary rounded-full"></div>
                  <h2 className="text-xl font-semibold text-foreground">Información General</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="client_id" className="text-sm font-medium text-foreground">
                      Cliente Gestor <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.client_id}
                      onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                      required
                    >
                      <SelectTrigger className="h-12 bg-background border-input">
                        <SelectValue placeholder="Selecciona un cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Cliente que gestiona esta póliza
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="company_id" className="text-sm font-medium text-foreground">Aseguradora</Label>
                    <Select
                      value={formData.company_id}
                      onValueChange={(value) => setFormData({ ...formData, company_id: value })}
                    >
                      <SelectTrigger className="h-12 bg-background border-input">
                        <SelectValue placeholder="Selecciona una aseguradora" />
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
              </div>

              {/* Información del Asegurado */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="w-2 h-8 bg-primary rounded-full"></div>
                  <User className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold text-foreground">Información del Asegurado</h2>
                </div>

                <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg border border-border">
                  <input
                    type="checkbox"
                    id="useClientAsInsured"
                    checked={useClientAsInsured}
                    onChange={(e) => setUseClientAsInsured(e.target.checked)}
                    className="h-4 w-4 text-primary focus:ring-primary border-input rounded"
                  />
                  <Label htmlFor="useClientAsInsured" className="text-sm font-medium text-foreground">
                    El asegurado es el mismo cliente gestor
                  </Label>
                </div>

                {!useClientAsInsured && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-muted/30 rounded-lg border border-border">
                    <div className="space-y-3">
                      <Label htmlFor="nombre_asegurado" className="text-sm font-medium text-foreground">
                        Nombre del Asegurado <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="nombre_asegurado"
                        className="h-12 bg-background border-input"
                        value={formData.nombre_asegurado}
                        onChange={(e) => setFormData({ ...formData, nombre_asegurado: e.target.value })}
                        placeholder="Nombre completo"
                        required={!useClientAsInsured}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="documento_asegurado" className="text-sm font-medium text-foreground">Documento</Label>
                      <Input
                        id="documento_asegurado"
                        className="h-12 bg-background border-input"
                        value={formData.documento_asegurado}
                        onChange={(e) => setFormData({ ...formData, documento_asegurado: e.target.value })}
                        placeholder="CI del asegurado"
                      />
                    </div>

                    <div className="space-y-3">
                      <Label htmlFor="parentesco" className="text-sm font-medium text-foreground">
                        Parentesco <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.parentesco}
                        onValueChange={(value) => setFormData({ ...formData, parentesco: value })}
                        required={!useClientAsInsured}
                      >
                        <SelectTrigger className="h-12 bg-background border-input">
                          <SelectValue placeholder="Relación" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cónyuge">Cónyuge</SelectItem>
                          <SelectItem value="Hijo/a">Hijo/a</SelectItem>
                          <SelectItem value="Padre">Padre</SelectItem>
                          <SelectItem value="Madre">Madre</SelectItem>
                          <SelectItem value="Hermano/a">Hermano/a</SelectItem>
                          <SelectItem value="Familiar">Familiar</SelectItem>
                          <SelectItem value="Tercero">Tercero</SelectItem>
                          <SelectItem value="Otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {useClientAsInsured && selectedClient && (
                  <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-sm text-primary font-medium">
                      <strong>Asegurado:</strong> {selectedClient.nombre} (Titular)
                    </p>
                  </div>
                )}
              </div>

              {/* Detalles de la Póliza */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="w-2 h-8 bg-primary rounded-full"></div>
                  <h2 className="text-xl font-semibold text-foreground">Detalles de la Póliza</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="numero_poliza" className="text-sm font-medium text-foreground">
                      Número de Póliza <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="numero_poliza"
                      className="h-12 bg-background border-input"
                      value={formData.numero_poliza}
                      onChange={(e) => setFormData({ ...formData, numero_poliza: e.target.value })}
                      placeholder="Ej: POL-2024-001"
                      required
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="tipo" className="text-sm font-medium text-foreground">
                      Tipo de Póliza <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.tipo}
                      onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                      required
                    >
                      <SelectTrigger className="h-12 bg-background border-input">
                        <SelectValue placeholder="Selecciona el tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Auto">Auto</SelectItem>
                        <SelectItem value="Vida">Vida</SelectItem>
                        <SelectItem value="Hogar">Hogar</SelectItem>
                        <SelectItem value="Salud">Salud</SelectItem>
                        <SelectItem value="Empresarial">Empresarial</SelectItem>
                        <SelectItem value="Empresarial">Otro</SelectItem>
                        <SelectItem value="Empresarial">Camiones</SelectItem>
                        <SelectItem value="Empresarial">Taxi</SelectItem>
                        <SelectItem value="Empresarial">Agricola</SelectItem>
                        <SelectItem value="Empresarial">Empresarial</SelectItem>
                        <SelectItem value="Empresarial">Motos</SelectItem>
                        





                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label htmlFor="vigencia_inicio" className="text-sm font-medium text-foreground">
                      Fecha de Inicio <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="vigencia_inicio"
                      type="date"
                      className="h-12 bg-background border-input"
                      value={formData.vigencia_inicio}
                      onChange={(e) => setFormData({ ...formData, vigencia_inicio: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="vigencia_fin" className="text-sm font-medium text-foreground">
                      Fecha de Fin <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="vigencia_fin"
                      type="date"
                      className="h-12 bg-background border-input"
                      value={formData.vigencia_fin}
                      onChange={(e) => setFormData({ ...formData, vigencia_fin: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Documentos */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="w-2 h-8 bg-primary rounded-full"></div>
                  <h2 className="text-xl font-semibold text-foreground">Documentos de la Póliza</h2>
                </div>

                <div className="space-y-6">
                  {/* Área de carga de archivos */}
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors bg-muted/20">
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <div>
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <span className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                          Arrastra archivos aquí o haz clic para seleccionar
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
                      <p className="mt-2 text-xs text-muted-foreground">
                        PDF, DOC, DOCX hasta 10MB cada uno. Puedes seleccionar múltiples archivos.
                      </p>
                    </div>
                  </div>

                  {/* Lista de archivos */}
                  {fileAttachments.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-foreground">
                          Archivos adjuntos
                        </h3>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                          {fileAttachments.length} archivo{fileAttachments.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {fileAttachments.map((attachment) => (
                          <div
                            key={attachment.id}
                            className="flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:shadow-sm transition-shadow"
                          >
                            <div className="flex items-center min-w-0 flex-1">
                              <FileText className="h-6 w-6 text-primary flex-shrink-0" />
                              <div className="ml-3 min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {attachment.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {attachment.size ? formatFileSize(attachment.size) : "Archivo existente"}
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(attachment.id)}
                              className="ml-2 flex-shrink-0 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notas */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-border">
                  <div className="w-2 h-8 bg-primary rounded-full"></div>
                  <h2 className="text-xl font-semibold text-foreground">Información Adicional</h2>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="notas" className="text-sm font-medium text-foreground">Notas</Label>
                  <Textarea
                    id="notas"
                    value={formData.notas}
                    onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
                    placeholder="Notas adicionales sobre la póliza..."
                    rows={4}
                    className="resize-none bg-background border-input"
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-4 pt-8 border-t border-border">
                <Button type="button" variant="outline" className="w-full sm:w-auto h-12">
                  Cancelar
                </Button>
                <Button type="submit" disabled={uploading} className="w-full sm:w-auto h-12">
                  {uploading ? "Procesando..." : initialData ? "Actualizar Póliza" : "Crear Póliza"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
