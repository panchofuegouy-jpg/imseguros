"use client"

import { useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Loader2, Upload, X, FileText, CheckCircle, AlertCircle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface Company {
    id: string;
    name: string;
}

interface MultiFilePolicyUploaderProps {
    clientId: string;
    companies: Company[];
    onUploadComplete: () => void;
    trigger?: React.ReactNode;
    n8nWebhookUrl?: string; // URL del webhook de n8n
}

interface FileStatus {
    file: File;
    status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
    progress: number;
    error?: string;
    extractedData?: any;
    policyId?: string;
}

export function MultiFilePolicyUploader({
    clientId,
    companies,
    onUploadComplete,
    trigger,
    n8nWebhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'https://centro-n8n.xqnwvv.easypanel.host/webhook/75fb7c2d-82f0-4514-b137-6aee42432f42'
}: MultiFilePolicyUploaderProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [files, setFiles] = useState<FileStatus[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const supabase = createClient();

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map(file => ({
                file,
                status: 'pending' as const,
                progress: 0
            }));
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const processFiles = async () => {
        setIsProcessing(true);

        for (let i = 0; i < files.length; i++) {
            const fileStatus = files[i];
            if (fileStatus.status === 'completed') continue;

            try {
                // 1. Upload File to Supabase Storage
                setFiles(prev => prev.map((f, idx) =>
                    idx === i ? { ...f, status: 'uploading', progress: 20 } : f
                ));

                const fileExt = fileStatus.file.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
                const filePath = `${clientId}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('policy-documents')
                    .upload(filePath, fileStatus.file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('policy-documents')
                    .getPublicUrl(filePath);

                // 2. Send to n8n webhook for OCR processing
                setFiles(prev => prev.map((f, idx) =>
                    idx === i ? { ...f, status: 'processing', progress: 50 } : f
                ));

                const formData = new FormData();
                formData.append('file', fileStatus.file);
                formData.append('fileUrl', publicUrl);
                formData.append('clientId', clientId);
                formData.append('fileName', fileStatus.file.name);

                const webhookResponse = await fetch(n8nWebhookUrl, {
                    method: 'POST',
                    body: formData,
                });

                if (!webhookResponse.ok) {
                    throw new Error(`Webhook error: ${webhookResponse.statusText}`);
                }

                const webhookData = await webhookResponse.json();
                const extracted = webhookData.extractedData || {};

                setFiles(prev => prev.map((f, idx) =>
                    idx === i ? { ...f, progress: 80 } : f
                ));

                // 3. Create Policy Record in Database
                const policyData = {
                    client_id: clientId,
                    numero_poliza: extracted.numero_poliza || `PEND-${Date.now()}`,
                    tipo: extracted.tipo || 'Desconocido',
                    vigencia_inicio: extracted.vigencia_inicio || new Date().toISOString().split('T')[0],
                    vigencia_fin: extracted.vigencia_fin || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
                    company_id: extracted.company_id || null,
                    nombre_asegurado: extracted.nombre_asegurado || null,
                    documento_asegurado: extracted.documento_asegurado || null,
                    parentesco: extracted.parentesco || 'Titular',
                    archivo_url: publicUrl,
                    archivo_urls: [publicUrl],
                    notas: extracted.notas || `Cargado automáticamente desde ${fileStatus.file.name}`
                };

                const { data: newPolicy, error: dbError } = await supabase
                    .from('policies')
                    .insert([policyData])
                    .select()
                    .single();

                if (dbError) throw dbError;

                setFiles(prev => prev.map((f, idx) =>
                    idx === i ? {
                        ...f,
                        status: 'completed',
                        progress: 100,
                        extractedData: extracted,
                        policyId: newPolicy.id
                    } : f
                ));

            } catch (error: any) {
                console.error("Error processing file:", error);
                setFiles(prev => prev.map((f, idx) =>
                    idx === i ? { ...f, status: 'error', error: error.message } : f
                ));
            }
        }

        setIsProcessing(false);
        toast.success("Proceso completado");
        onUploadComplete();
    };

    const reset = () => {
        setFiles([]);
        setIsProcessing(false);
    };

    const getStatusIcon = (status: FileStatus['status']) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'error':
                return <AlertCircle className="h-4 w-4 text-red-500" />;
            case 'processing':
                return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
            case 'uploading':
                return <Upload className="h-4 w-4 text-blue-500" />;
            default:
                return <FileText className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getStatusText = (status: FileStatus['status']) => {
        switch (status) {
            case 'uploading':
                return 'Subiendo archivo...';
            case 'processing':
                return 'Procesando OCR con n8n...';
            case 'completed':
                return 'Completado';
            case 'error':
                return 'Error';
            default:
                return 'Pendiente';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline">Cargar Pólizas</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Carga Masiva de Pólizas</DialogTitle>
                    <DialogDescription>
                        Selecciona archivos PDF o imágenes de pólizas. El sistema procesará automáticamente los datos usando OCR.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {!n8nWebhookUrl && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
                            ⚠️ URL del webhook de n8n no configurada. Configura NEXT_PUBLIC_N8N_WEBHOOK_URL en tu archivo .env
                        </div>
                    )}

                    <div className="grid w-full items-center gap-1.5">
                        <Input
                            id="policy-files"
                            type="file"
                            multiple
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handleFileSelect}
                            disabled={isProcessing || !n8nWebhookUrl}
                        />
                        <p className="text-xs text-muted-foreground">
                            Formatos soportados: PDF, PNG, JPG, JPEG
                        </p>
                    </div>

                    <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                        <div className="space-y-3">
                            {files.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    <p>No hay archivos seleccionados</p>
                                    <p className="text-xs">Selecciona archivos para comenzar</p>
                                </div>
                            ) : (
                                files.map((fileStatus, index) => (
                                    <Card key={index}>
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-2 overflow-hidden flex-1">
                                                    {getStatusIcon(fileStatus.status)}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">
                                                            {fileStatus.file.name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {(fileStatus.file.size / 1024).toFixed(1)} KB
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 ml-2">
                                                    <Badge variant={
                                                        fileStatus.status === 'completed' ? 'default' :
                                                            fileStatus.status === 'error' ? 'destructive' :
                                                                fileStatus.status === 'processing' || fileStatus.status === 'uploading' ? 'secondary' :
                                                                    'outline'
                                                    }>
                                                        {getStatusText(fileStatus.status)}
                                                    </Badge>
                                                    {fileStatus.status === 'pending' && !isProcessing && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeFile(index)}
                                                            className="h-6 w-6"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            {fileStatus.status !== 'pending' && (
                                                <div className="space-y-1 mb-2">
                                                    <div className="flex justify-between text-xs text-muted-foreground">
                                                        <span>{getStatusText(fileStatus.status)}</span>
                                                        <span>{fileStatus.progress}%</span>
                                                    </div>
                                                    <Progress value={fileStatus.progress} className="h-1.5" />
                                                </div>
                                            )}

                                            {fileStatus.extractedData && (
                                                <div className="mt-3 text-xs bg-muted p-3 rounded space-y-1">
                                                    <p className="font-semibold text-foreground mb-1">Datos extraídos:</p>
                                                    <p><span className="text-muted-foreground">Póliza:</span> {fileStatus.extractedData.numero_poliza || 'N/A'}</p>
                                                    <p><span className="text-muted-foreground">Tipo:</span> {fileStatus.extractedData.tipo || 'N/A'}</p>
                                                    <p><span className="text-muted-foreground">Asegurado:</span> {fileStatus.extractedData.nombre_asegurado || 'N/A'}</p>
                                                    {fileStatus.extractedData.vigencia_inicio && fileStatus.extractedData.vigencia_fin && (
                                                        <p><span className="text-muted-foreground">Vigencia:</span> {fileStatus.extractedData.vigencia_inicio} a {fileStatus.extractedData.vigencia_fin}</p>
                                                    )}
                                                </div>
                                            )}

                                            {fileStatus.error && (
                                                <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                                                    <p className="font-semibold">Error:</p>
                                                    <p>{fileStatus.error}</p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    </ScrollArea>

                    <div className="flex justify-between items-center gap-2 pt-2 border-t">
                        <div className="text-xs text-muted-foreground">
                            {files.length > 0 && (
                                <span>
                                    {files.filter(f => f.status === 'completed').length} de {files.length} completados
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={reset}
                                disabled={isProcessing}
                                size="sm"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Limpiar
                            </Button>
                            <Button
                                onClick={processFiles}
                                disabled={files.length === 0 || isProcessing || !n8nWebhookUrl}
                                size="sm"
                            >
                                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isProcessing ? 'Procesando...' : 'Iniciar Carga'}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
