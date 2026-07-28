# OCR Directo con OpenAI GPT-4o mini

## Cambio de Arquitectura

Se eliminó la dependencia de n8n webhook. Ahora el OCR se procesa directamente usando **OpenAI GPT-4o mini Vision** (80% más económico que Claude).

### Antes (n8n)
```
Cliente → Webhook n8n → Servicio OCR → JSON → Aplicación
```

### Después (Directo)
```
Cliente → /api/ocr/extract → OpenAI GPT-4o mini → JSON → Aplicación
```

## Ventajas

✅ **Más rápido** - Sin latencia de n8n  
✅ **Más confiable** - Menos puntos de fallo  
✅ **Más económico** - 80-95% menos caro que Claude  
✅ **Más simple** - Una sola llamada API  
✅ **Mejor debugging** - Logs directos  

## Configuración Requerida

### Variable de Entorno

Ya deberías tener en tu `.env`:

```bash
OPENAI_API_KEY=sk-...
```

Verifica que esté presente y tenga acceso a vision capabilities.

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

### 3. Servidor procesa con OpenAI

`/api/ocr/extract` recibe el archivo y:

1. Convierte a base64
2. Envía a OpenAI GPT-4o mini con el prompt OCR
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

### Error: "OPENAI_API_KEY not configured"

```bash
# Falta OPENAI_API_KEY en .env
OPENAI_API_KEY=sk-...
```

### Error: "Invalid JSON response from OpenAI"

OpenAI no devolvió JSON válido. El endpoint intenta:
1. Parsear directamente
2. Buscar JSON entre backticks
3. Si falla, error descriptivo

### Error: "Error al procesar el documento"

Posibles causas:
- Archivo corrupto o no es PDF/imagen válida
- Imagen ilegible o muy oscura
- Documento no es póliza
- Rate limit de OpenAI API
- Llamada timeout (>30s)

## Testing Manual

Para probar el endpoint directamente:

```bash
curl -X POST http://localhost:3000/api/ocr/extract \
  -F "file=@poliza.pdf" \
  -F "clientId=test-client-123"
```

## Costos API

OpenAI GPT-4o mini Vision cobra por tokens:

- **Tokens de entrada (vision):** $0.15 por millón
- **Tokens de salida:** $0.60 por millón

Una póliza típica (1-2 páginas):
- ~1,000 tokens entrada
- ~300 tokens salida
- **Costo aproximado:** $0.0005 USD por póliza

**100 pólizas/mes:** $0.05 USD

**Comparación:**
- OpenAI GPT-4o mini: $0.0005/póliza ⭐
- Claude 3.5 Sonnet: $0.009/póliza (18x más caro)
- n8n + otros servicios: variable

## Logging

Revisa los logs del servidor para:

```
Starting OCR extraction with OpenAI: { fileName, fileType, fileSize, clientId }
OpenAI response received: { model: 'gpt-4o-mini', inputTokens, outputTokens }
OCR extraction successful: { hasNumeroPoliza, hasTipo, hasVigencia, provider: 'openai' }
```

O errores:

```
OpenAI API error: { error details }
OCR extraction error: { error details }
```

## Próximos Pasos

- [x] OPENAI_API_KEY ya está en `.env`
- [ ] Testear OCR en `/admin/polizas/por-vencer`
- [ ] Revisar logs (F12 Console) para verificar extracción correcta
- [ ] Monitorear costos en OpenAI dashboard

## Testing Rápido

```bash
# Prueba con curl
curl -X POST http://localhost:3000/api/ocr/extract \
  -F "file=@poliza.pdf" \
  -F "clientId=test-123"

# Respuesta esperada:
# {"extractedData": {...}, "status": "success", "provider": "openai"}
```
