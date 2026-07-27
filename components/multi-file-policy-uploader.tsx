"use client"

import { useState } from "react"
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
import { normalizeOcrDate } from "@/lib/ocr-date"

const parseWebhookExtractedData = (payload: any) => {
    const normalize = (value: any): any => {
        if (!value) return undefined;
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return normalize(parsed);
            } catch (e) {
                return undefined;
            }
        }
        if (Array.isArray(value)) {
            return fromArray(value);
        }
        if (typeof value === 'object') {
            return value;
        }
        return undefined;
    };

    const fromArray = (value: any): any => {
        if (!Array.isArray(value) || value.length === 0) return undefined;
        const first = value[0];
        return normalize(
            first?.extractedData ||
            first?.data ||
            first?.json ||
            first?.output?.[0]?.content?.[0]?.text ||
            first?.output?.[0]?.json ||
            first
        );
    };

    const candidates = [
        normalize(payload?.extractedData),
        normalize(payload?.data),
        normalize(payload?.output?.[0]?.content?.[0]?.text || payload?.output?.[0]?.json),
        fromArray(payload),
        normalize(payload),
    ].filter(Boolean);

    return candidates[0] || {};
}

interface Company {
    id: string;
    name: string;
}

interface MultiFilePolicyUploaderProps {
    clientId: string;
    companies: Company[];
    onUploadComplete: () => void;
    trigger?: React.ReactNode;
}

// Campos editables que el usuario revisa antes de guardar
interface PolicyDraft {
    numero_poliza: string;
    tipo: string;
    company_id: string;
    vigencia_inicio: string;
    vigencia_fin: string;
    prima_monto: string;
    moneda: string;
}

interface FileStatus {
    file: File;
    status: 'pending' | 'uploading' | 'processing' | 'ready' | 'saving' | 'completed' | 'error';
    progress: number;
    error?: string;
    storedPath?: string;
    extracted?: any;      // datos crudos del OCR (para campos no editables)
    draft?: PolicyDraft;  // campos editables para la revisión
    policyId?: string;
}

export function MultiFilePolicyUploader({
    clientId,
    companies,
    onUploadComplete,
    trigger
}: MultiFilePolicyUploaderProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [files, setFiles] = useState<FileStatus[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
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

    // Intenta hacer coincidir la aseguradora extraída con una de la lista
    const matchCompanyId = (extracted: any): string => {
        const raw = extracted?.company_id ?? extracted?.aseguradora ?? extracted?.compania ?? extracted?.company ?? extracted?.empresa;
        if (!raw) return '';
        const byId = companies.find(c => c.id === raw);
        if (byId) return byId.id;
        const byName = companies.find(c => c.name.toLowerCase() === String(raw).toLowerCase());
        return byName ? byName.id : '';
    };

    const buildDraft = (extracted: any): PolicyDraft => {
        const defaultStart = new Date().toISOString().split('T')[0];
        const defaultEnd = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];
        const primaRaw = extracted.total_a_pagar ?? extracted.prima_monto ?? extracted.prima ?? extracted.monto ?? extracted.importe ?? extracted.premio;
        return {
            numero_poliza: extracted.numero_poliza != null ? String(extracted.numero_poliza) : '',
            tipo: extracted.tipo != null ? String(extracted.tipo) : '',
            company_id: matchCompanyId(extracted),
            vigencia_inicio: normalizeOcrDate(extracted.vigencia_inicio, defaultStart),
            vigencia_fin: normalizeOcrDate(extracted.vigencia_fin, defaultEnd),
            prima_monto: primaRaw != null ? String(primaRaw) : '',
            moneda: extracted.moneda ?? 'UYU',
        };
    };

    const updateDraft = (index: number, field: keyof PolicyDraft, value: string) => {
        setFiles(prev => prev.map((f, i) =>
            i === index && f.draft ? { ...f, draft: { ...f.draft, [field]: value } } : f
        ));
    };

    // Fase 1: sube cada archivo y corre el OCR. NO guarda nada todavía.
    const analyzeFiles = async () => {
        setIsProcessing(true);

        for (let i = 0; i < files.length; i++) {
            const fileStatus = files[i];
            if (fileStatus.status !== 'pending') continue;

            try {
                setFiles(prev => prev.map((f, idx) =>
                    idx === i ? { ...f, status: 'uploading', progress: 20 } : f
                ));

                const fileExt = fileStatus.file.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
                const filePath = `${clientId}/${fileName}`;

                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('policy-documents')
                    .upload(filePath, fileStatus.file);

                if (uploadError) throw uploadError;

                const storedPath = uploadData?.path ?? filePath;

                setFiles(prev => prev.map((f, idx) =>
                    idx === i ? { ...f, status: 'processing', progress: 50 } : f
                ));

                const formData = new FormData();
                formData.append('file', fileStatus.file);
                formData.append('filePath', storedPath);
                formData.append('clientId', clientId);
                formData.append('fileName', fileStatus.file.name);

                const webhookResponse = await fetch('/api/ocr-webhook', {
                    method: 'POST',
                    body: formData,
                });

                if (!webhookResponse.ok) {
                    let detail = webhookResponse.statusText;
                    try {
                        const errBody = await webhookResponse.json();
                        if (errBody?.error) detail = errBody.error;
                    } catch { /* respuesta sin JSON */ }
                    throw new Error(`Error del servidor OCR (${webhookResponse.status}): ${detail}`);
                }

                const webhookData = await webhookResponse.json();
                const extracted = parseWebhookExtractedData(webhookData);

                setFiles(prev => prev.map((f, idx) =>
                    idx === i ? {
                        ...f,
                        status: 'ready',
                        progress: 100,
                        storedPath,
                        extracted,
                        draft: buildDraft(extracted),
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
    };

    // Fase 2: guarda en la base las pólizas ya revisadas.
    const confirmAndSave = async () => {
        setIsSaving(true);

        const parsePrimaMonto = (val: any): number | null => {
            if (val === null || val === undefined || val === '') return null;
            const num = parseFloat(String(val).replace(/[^\d.,-]/g, '').replace(',', '.'));
            return isNaN(num) ? null : num;
        };

        let savedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < files.length; i++) {
            const fileStatus = files[i];
            if (fileStatus.status !== 'ready' || !fileStatus.draft) continue;

            setFiles(prev => prev.map((f, idx) =>
                idx === i ? { ...f, status: 'saving' } : f
            ));

            try {
                const d = fileStatus.draft;
                const extracted = fileStatus.extracted ?? {};
                const defaultEnd = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0];

                const policyData = {
                    client_id: clientId,
                    numero_poliza: d.numero_poliza.trim() || `PEND-${Date.now()}`,
                    tipo: d.tipo.trim() || 'Desconocido',
                    vigencia_inicio: d.vigencia_inicio || new Date().toISOString().split('T')[0],
                    vigencia_fin: d.vigencia_fin || defaultEnd,
                    company_id: d.company_id || null,
                    nombre_asegurado: extracted.nombre_asegurado ?? null,
                    documento_asegurado: extracted.documento_asegurado ?? null,
                    parentesco: extracted.parentesco ?? 'Titular',
                    archivo_url: fileStatus.storedPath,
                    archivo_urls: [fileStatus.storedPath],
                    notas: extracted.notas ?? `Cargado automáticamente desde ${fileStatus.file.name}`,
                    prima_monto: parsePrimaMonto(d.prima_monto),
                    moneda: d.moneda || 'UYU',
                    forma_pago: extracted.forma_pago ?? extracted.frecuencia_pago ?? null,
                    numero_factura: extracted.numero_factura ?? extracted.factura ?? null,
                };

                const { data: newPolicy, error: dbError } = await supabase
                    .from('policies')
                    .insert([policyData])
                    .select()
                    .single();

                if (dbError) throw dbError;

                savedCount++;
                setFiles(prev => prev.map((f, idx) =>
                    idx === i ? { ...f, status: 'completed', policyId: newPolicy.id } : f
                ));

            } catch (error: any) {
                console.error("Error saving policy:", error);
                errorCount++;
                setFiles(prev => prev.map((f, idx) =>
                    idx === i ? { ...f, status: 'error', error: error.message } : f
                ));
            }
        }

        setIsSaving(false);

        if (savedCount > 0) {
            toast.success(`${savedCount} póliza${savedCount > 1 ? 's' : ''} guardada${savedCount > 1 ? 's' : ''}`);
            onUploadComplete();
        }

        if (errorCount === 0) {
            setIsOpen(false);
            setTimeout(() => reset(), 300);
        } else {
            toast.error(`${errorCount} archivo${errorCount > 1 ? 's' : ''} no se pudo guardar`);
        }
    };

    const reset = () => {
        setFiles([]);
        setIsProcessing(false);
        setIsSaving(false);
    };

    const getStatusIcon = (status: FileStatus['status']) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="h-4 w-4 text-primary" />;
            case 'error':
                return <AlertCircle className="h-4 w-4 text-red-500" />;
            case 'processing':
                return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
            case 'saving':
                return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
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
                return 'Procesando OCR...';
            case 'ready':
                return 'Revisar';
            case 'saving':
                return 'Guardando...';
            case 'completed':
                return 'Guardado';
            case 'error':
                return 'Error';
            default:
                return 'Pendiente';
        }
    };

    const pendingCount = files.filter(f => f.status === 'pending').length;
    const readyCount = files.filter(f => f.status === 'ready').length;
    const completedCount = files.filter(f => f.status === 'completed').length;
    const busy = isProcessing || isSaving;

    const selectClass = "flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50";

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!busy) setIsOpen(open); }}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline">Cargar Pólizas</Button>}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Carga Masiva de Pólizas</DialogTitle>
                    <DialogDescription>
                        Selecciona archivos PDF o imágenes. El sistema extrae los datos con OCR y podés revisarlos antes de guardar.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="grid w-full items-center gap-1.5">
                        <Input
                            id="policy-files"
                            type="file"
                            multiple
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handleFileSelect}
                            disabled={busy}
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
                                                                fileStatus.status === 'ready' ? 'outline' :
                                                                    'secondary'
                                                    }>
                                                        {getStatusText(fileStatus.status)}
                                                    </Badge>
                                                    {fileStatus.status === 'pending' && !busy && (
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

                                            {(fileStatus.status === 'uploading' || fileStatus.status === 'processing') && (
                                                <div className="space-y-1 mb-2">
                                                    <div className="flex justify-between text-xs text-muted-foreground">
                                                        <span>{getStatusText(fileStatus.status)}</span>
                                                        <span>{fileStatus.progress}%</span>
                                                    </div>
                                                    <Progress value={fileStatus.progress} className="h-1.5" />
                                                </div>
                                            )}

                                            {(fileStatus.status === 'ready' || fileStatus.status === 'saving') && fileStatus.draft && (
                                                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                                                    <div className="col-span-2 sm:col-span-1">
                                                        <label className="text-[11px] text-muted-foreground">N° Póliza</label>
                                                        <Input
                                                            value={fileStatus.draft.numero_poliza}
                                                            onChange={e => updateDraft(index, 'numero_poliza', e.target.value)}
                                                            disabled={fileStatus.status === 'saving'}
                                                            className="h-8 text-xs"
                                                        />
                                                    </div>
                                                    <div className="col-span-2 sm:col-span-1">
                                                        <label className="text-[11px] text-muted-foreground">Tipo</label>
                                                        <Input
                                                            value={fileStatus.draft.tipo}
                                                            onChange={e => updateDraft(index, 'tipo', e.target.value)}
                                                            disabled={fileStatus.status === 'saving'}
                                                            className="h-8 text-xs"
                                                        />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="text-[11px] text-muted-foreground">Aseguradora</label>
                                                        <select
                                                            value={fileStatus.draft.company_id}
                                                            onChange={e => updateDraft(index, 'company_id', e.target.value)}
                                                            disabled={fileStatus.status === 'saving'}
                                                            className={selectClass}
                                                        >
                                                            <option value="">— Sin asignar —</option>
                                                            {companies.map(c => (
                                                                <option key={c.id} value={c.id}>{c.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[11px] text-muted-foreground">Vigencia inicio</label>
                                                        <Input
                                                            type="date"
                                                            value={fileStatus.draft.vigencia_inicio}
                                                            onChange={e => updateDraft(index, 'vigencia_inicio', e.target.value)}
                                                            disabled={fileStatus.status === 'saving'}
                                                            className="h-8 text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[11px] text-muted-foreground">Vigencia fin</label>
                                                        <Input
                                                            type="date"
                                                            value={fileStatus.draft.vigencia_fin}
                                                            onChange={e => updateDraft(index, 'vigencia_fin', e.target.value)}
                                                            disabled={fileStatus.status === 'saving'}
                                                            className="h-8 text-xs"
                                                        />
                                                    </div>
                                                    <div className="col-span-2 flex gap-3">
                                                        <div className="flex-1">
                                                            <label className="text-[11px] text-muted-foreground">Prima / Total</label>
                                                            <Input
                                                                value={fileStatus.draft.prima_monto}
                                                                onChange={e => updateDraft(index, 'prima_monto', e.target.value)}
                                                                disabled={fileStatus.status === 'saving'}
                                                                className="h-8 text-xs"
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                        <div className="w-24">
                                                            <label className="text-[11px] text-muted-foreground">Moneda</label>
                                                            <select
                                                                value={fileStatus.draft.moneda}
                                                                onChange={e => updateDraft(index, 'moneda', e.target.value)}
                                                                disabled={fileStatus.status === 'saving'}
                                                                className={selectClass}
                                                            >
                                                                <option value="UYU">UYU</option>
                                                                <option value="USD">USD</option>
                                                            </select>
                                                        </div>
                                                    </div>
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
                                    {readyCount > 0
                                        ? `${readyCount} para revisar`
                                        : `${completedCount} de ${files.length} guardadas`}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={reset}
                                disabled={busy || files.length === 0}
                                size="sm"
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Limpiar
                            </Button>
                            {pendingCount > 0 && (
                                <Button
                                    onClick={analyzeFiles}
                                    disabled={busy}
                                    size="sm"
                                >
                                    {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isProcessing ? 'Procesando...' : `Procesar (${pendingCount})`}
                                </Button>
                            )}
                            {readyCount > 0 && (
                                <Button
                                    onClick={confirmAndSave}
                                    disabled={busy}
                                    size="sm"
                                >
                                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isSaving ? 'Guardando...' : `Confirmar y guardar (${readyCount})`}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
