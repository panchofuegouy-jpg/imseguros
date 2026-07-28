# OCR Directo con Claude API

## Cambio de Arquitectura

Se eliminó la dependencia de n8n webhook. Ahora el OCR se procesa directamente usando Claude 3.5 Sonnet Vision.

### Antes (n8n)
```
Cliente → Webhook n8n → Claude API → JSON → Aplicación
```

### Después (Directo)
```
Cliente → /api/ocr/extract → Claude API → JSON → Aplicación
```

## Ventajas

✅ **Más rápido** - Sin latencia de n8n  
✅ **Más confiable** - Menos puntos de fallo  
✅ **Más simple** - Menos configuración externa  
✅ **Mejor debugging** - Logs directos de Claude  
✅ **Mejor precisión** - Manejo consistente de respuestas  

## Configuración Requerida

### Variable de Entorno

Agrega a tu `.env.local`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

La API key debe tener acceso a vision capabilities.

## Flujo Técnico

### 1. Usuario selecciona archivo

En `/admin/polizas/por-vencer`, el usuario hace click en "Analizar con OCR" y selecciona un PDF o imagen.

### 2. Archivo se sube y procesa

```typescript
const formData = new FormData()
formData.append("file", file)
formData.append("clientId", policy.client_id)

const response = await fetch("/api/ocr/extract", { 
  method: "POST", 
  body: formData 
})
```

### 3. Servidor procesa con Claude

`/api/ocr/extract` recibe el archivo y:

1. Convierte a base64
2. Envía a Claude 3.5 Sonnet con el prompt OCR
3. Parsea la respuesta JSON
4. Retorna `{ extractedData: {...} }`

### 4. Componente llena el formulario

Los datos extraídos se mapean a campos del formulario:

```typescript
const ext = responseData.extractedData || responseData

setFormData(prev => ({
  ...prev,
  numero_poliza: ext.numero_poliza || prev.numero_poliza,
  tipo: ext.tipo || prev.tipo,
  vigencia_inicio: normalizeOcrDate(ext.vigencia_inicio, prev.vigencia_inicio),
  // ... otros campos
}))
```

## Formato de Respuesta

El endpoint `/api/ocr/extract` devuelve:

```json
{
  "extractedData": {
    "numero_poliza": "639864",
    "tipo": "GARANTÍA DE ALQUILER",
    "vigencia_inicio": "2025-08-30",
    "vigencia_fin": "2026-08-30",
    "company_id": "954f4352-6993-4ece-946b-d114cbe238e0",
    "nombre_asegurado": "CLIENTE NOMBRE",
    "documento_asegurado": "ABC123",
    "parentesco": "Titular",
    "total_a_pagar": 1500,
    "prima_monto": 1200,
    "moneda": "UYU",
    "forma_pago": "Anual",
    "numero_factura": "F-001234",
    "notas": "Matrícula: ABC123. Vehículo..., suma asegurada U$S 70.000, plan Todo Riesgo y RC del BSE."
  },
  "status": "success"
}
```

## Reglas del Prompt OCR

El prompt está embebido en `/api/ocr/extract/route.ts` y asegura:

1. **Fechas en formato ISO** - DD/MM/AAAA → YYYY-MM-DD
2. **Parentesco siempre "Titular"**
3. **Número de póliza sin ceros a izquierda**
4. **Company ID de lista predefinida** (SURA, Porto, BSE, Sancor, Mapfre)
5. **Documento asegurado prioriza matrícula** → cédula → "DESCONOCIDO"
6. **Campos numéricos limpios** (sin símbolo de moneda)
7. **Notas con matrícula y detalles de cobertura**

## Manejo de Errores

### Error: "API Key not configured"

```bash
# .env.local falta ANTHROPIC_API_KEY
ANTHROPIC_API_KEY=sk-ant-...
```

### Error: "Invalid JSON response from Claude"

Claude no devolvió JSON válido. El endpoint intenta:
1. Parsear directamente
2. Buscar JSON entre backticks
3. Si falla, error descriptivo

### Error: "Error al procesar el documento"

Posibles causas:
- Archivo corrupto o no es PDF/imagen
- Imagen ilegible o muy oscura
- Documento no es póliza válida
- Rate limit de Claude API

## Testing Manual

Para probar el endpoint directamente:

```bash
curl -X POST http://localhost:3000/api/ocr/extract \
  -F "file=@poliza.pdf" \
  -F "clientId=test-client-123"
```

## Costos API

Claude 3.5 Sonnet Vision cobra por tokens:

- **Tokens de entrada:** ~$3 por millón (vision)
- **Tokens de salida:** ~$15 por millón

Una póliza típica (1-2 páginas):
- ~2,000 tokens entrada
- ~500 tokens salida
- **Costo aproximado:** $0.009 USD por póliza

vs. n8n que podría costar más con múltiples pasos y servicios.

## Logging

Revisa los logs del servidor para:

```
Starting OCR extraction: { fileName, fileType, fileSize, clientId }
Claude response received: { inputTokens, outputTokens, responseLength }
OCR extraction successful: { hasNumeroPoliza, hasTipo, hasVigencia }
```

O errores:

```
OCR extraction error: { error details }
```

## Fallback a n8n (Opcional)

Si quieres mantener n8n como fallback:

```typescript
try {
  const response = await fetch("/api/ocr/extract", ...)
  if (!response.ok) throw new Error("Claude failed")
  return response.json()
} catch (error) {
  console.warn("Falling back to n8n", error)
  const response = await fetch("/api/ocr-webhook", ...)
  return response.json()
}
```

Actualmente la aplicación usa SOLO el endpoint directo.

## Próximos Pasos

- [ ] Configurar `ANTHROPIC_API_KEY` en `.env.local`
- [ ] Testear OCR en `/admin/polizas/por-vencer`
- [ ] Revisar logs para verificar extracción correcta
- [ ] (Opcional) Remover n8n webhook si se confirma que todo funciona
