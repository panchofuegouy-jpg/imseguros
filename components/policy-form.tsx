"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Upload, FileText, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface PolicyFormProps {
  clients: Array<{ id: string; nombre: string }>
  companies: Array<{ id: string; name: string }>
  onSubmit: (policyData: any) => void
  initialData?: any
}

export default function PolicyForm({ clients, companies, onSubmit, initialData }: PolicyFormProps) {
  const [formData, setFormData] = useState({
    client_id: initialData?.client_id || "",
    company_id: initialData?.company_id || "",
    numero_poliza: initialData?.numero_poliza || "",
    tipo: initialData?.tipo || "",
    vigencia_inicio: initialData?.vigencia_inicio || "",
    vigencia_fin: initialData?.vigencia_fin || "",
    notas: initialData?.notas || "",
  })

  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [currentFileUrl, setCurrentFileUrl] = useState(initialData?.archivo_url || null)
  const supabase = createClient()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      // Validate file type (PDF, DOC, DOCX)
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]
      if (allowedTypes.includes(selectedFile.type)) {
        setFile(selectedFile)
      } else {
        alert("Por favor selecciona un archivo PDF, DOC o DOCX")
      }
    }
  }

  const uploadFile = async (file: File, policyId: string, clientId: string): Promise<string | null> => {
    console.log("PolicyForm: Attempting to upload file:", file.name, "for policy ID:", policyId, "and client ID:", clientId);
    try {
      setUploading(true);

      const fileExt = file.name.split(".").pop();
      const fileName = `${policyId}-${Date.now()}.${fileExt}`;
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
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("PolicyForm: Form submitted. Current form data:", formData);
    console.log("PolicyForm: File selected:", file);
    console.log("PolicyForm: Current file URL:", currentFileUrl);

    try {
      let archivo_url = currentFileUrl

      // If there's a new file to upload
      if (file) {
        console.log("PolicyForm: New file detected, attempting upload...");
        const tempPolicyId = initialData?.id || `temp-${Date.now()}`;
        // Pass formData.client_id to uploadFile
        archivo_url = await uploadFile(file, tempPolicyId, formData.client_id);
        if (!archivo_url) {
          alert("Error al subir el archivo de la póliza. Por favor, revisa la consola para más detalles.");
          return; // Stop submission if file upload failed
        }
        console.log("PolicyForm: File upload complete. Archivo URL:", archivo_url);
      }

      const policyData = {
        ...formData,
        archivo_url,
      }
      console.log("PolicyForm: Submitting policy data to parent component:", policyData);

      onSubmit(policyData)
    } catch (error) {
      console.error("PolicyForm: Error submitting form (PolicyForm):", error)
      alert("Error al guardar la póliza")
    }
  }

  const removeFile = () => {
    setFile(null)
    setCurrentFileUrl(null)
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{initialData ? "Editar Póliza" : "Nueva Póliza"}</CardTitle>
        <CardDescription>
          {initialData ? "Modifica los datos de la póliza" : "Ingresa los datos de la nueva póliza"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_id">Cliente *</Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                required
              >
                <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_id">Aseguradora</Label>
              <Select
                value={formData.company_id}
                onValueChange={(value) => setFormData({ ...formData, company_id: value })}
              >
                <SelectTrigger>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero_poliza">Número de Póliza *</Label>
              <Input
                id="numero_poliza"
                value={formData.numero_poliza}
                onChange={(e) => setFormData({ ...formData, numero_poliza: e.target.value })}
                placeholder="Ej: POL-2024-001"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo de Póliza *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Auto">Auto</SelectItem>
                  <SelectItem value="Vida">Vida</SelectItem>
                  <SelectItem value="Hogar">Hogar</SelectItem>
                  <SelectItem value="Salud">Salud</SelectItem>
                  <SelectItem value="Empresarial">Empresarial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vigencia_inicio">Fecha de Inicio *</Label>
              <Input
                id="vigencia_inicio"
                type="date"
                value={formData.vigencia_inicio}
                onChange={(e) => setFormData({ ...formData, vigencia_inicio: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vigencia_fin">Fecha de Fin *</Label>
              <Input
                id="vigencia_fin"
                type="date"
                value={formData.vigencia_fin}
                onChange={(e) => setFormData({ ...formData, vigencia_fin: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="archivo">Documento de Póliza</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
              {!file && !currentFileUrl ? (
                <div className="text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <span className="mt-2 block text-sm font-medium text-gray-900">
                        Arrastra un archivo aquí o haz clic para seleccionar
                      </span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        accept=".pdf,.doc,.docx"
                        onChange={handleFileChange}
                      />
                    </label>
                    <p className="mt-1 text-xs text-gray-500">PDF, DOC, DOCX hasta 10MB</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-blue-500" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{file ? file.name : "Archivo actual"}</p>
                      <p className="text-xs text-gray-500">
                        {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Documento de póliza"}
                      </p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={removeFile}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              placeholder="Notas adicionales sobre la póliza..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline">
              Cancelar
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Subiendo..." : initialData ? "Actualizar" : "Crear Póliza"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}