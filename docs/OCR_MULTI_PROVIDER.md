# OCR Multi-Provider con Fallback Automático

## Descripción

El sistema OCR ahora soporta múltiples proveedores con fallback automático:

1. **OpenAI GPT-4o mini** ⭐ (Más económico, ~80% menos caro)
2. **Mistral Large** (Alternativa económica)
3. **Claude 3.5 Sonnet** (Fallback final, más confiable)

Si el primer provider falla, automáticamente intenta el siguiente.

## Comparación de Costos

| Provider | Modelo | Input | Output | Por póliza |
|----------|--------|-------|--------|-----------|
| **OpenAI** | GPT-4o mini | $0.15/M | $0.60/M | ~**$0.0005** ✨ |
| OpenAI | GPT-4o | $2.50/M | $10/M | ~$0.0075 |
| **Mistral** | Large | $0.24/M | $0.72/M | ~$0.001 |
| **Claude** | 3.5 Sonnet | $3/M | $15/M | ~$0.009 |

**Con GPT-4o mini ahorras ~94% vs Claude por póliza.**

## Configuración Requerida

### Opción 1: Solo OpenAI (Recomendado para economía)

```bash
# .env.local
OPENAI_API_KEY=sk-...
```

### Opción 2: OpenAI + Mistral (Alternativas económicas)

```bash
# .env.local
OPENAI_API_KEY=sk-...
MISTRAL_API_KEY=...
```

### Opción 3: Todos los providers (Máxima flexibilidad)

```bash
# .env.local
OPENAI_API_KEY=sk-...
MISTRAL_API_KEY=...
ANTHROPIC_API_KEY=sk-ant-...
```

## Cómo Funciona

### Flujo de Fallback Automático

```
Usuario sube PDF
    ↓
¿OPENAI_API_KEY configurada?
    ├─ Sí → Intenta OpenAI GPT-4o mini
    │         ├─ ✅ Éxito → Devuelve datos
    │         └─ ❌ Falla → Continúa
    │
    ├─ ¿MISTRAL_API_KEY configurada?
    │     ├─ Sí → Intenta Mistral Large
    │     │         ├─ ✅ Éxito → Devuelve datos
    │     │         └─ ❌ Falla → Continúa
    │     │
    │     ├─ ¿ANTHROPIC_API_KEY configurada?
    │         ├─ Sí → Intenta Claude 3.5 Sonnet
    │         │         ├─ ✅ Éxito → Devuelve datos
    │         │         └─ ❌ Falla → Error
    │         │
    │         └─ No → Error: "Ningún OCR configurado"
    │
    └─ No → Error: "OPENAI_API_KEY no configurada"
```

## Respuesta del API

El endpoint `/api/ocr/extract` devuelve:

```json
{
  "extractedData": {
    "numero_poliza": "639864",
    "tipo": "GARANTÍA DE ALQUILER",
    ...
  },
  "status": "success",
  "provider": "openai"  // ← Indica cuál provider se usó
}
```

## Limitaciones por Provider

### OpenAI GPT-4o mini
- ✅ PDF, JPEG, PNG, GIF, WebP
- ✅ Muy económico
- ✅ Buena precisión
- ⚠️ Model más nuevo, menos probado en docs

### Mistral Large
- ✅ JPEG, PNG, GIF, WebP
- ❌ NO soporta PDF
- ✅ Alternativa económica
- ⚠️ Menos experiencia con documentos españoles

### Claude 3.5 Sonnet
- ✅ PDF, JPEG, PNG, GIF, WebP
- ✅ Mejor precisión en documentos complejos
- ❌ Más caro
- ✅ Production-ready

## Forzar un Provider Específico

Si quieres usar un provider específico en lugar del fallback automático:

```typescript
const formData = new FormData()
formData.append("file", file)
formData.append("clientId", clientId)
formData.append("provider", "openai")  // ← Fuerza OpenAI

const response = await fetch("/api/ocr/extract", { 
  method: "POST", 
  body: formData 
})
```

Valores válidos: `"openai"`, `"mistral"`, `"claude"`, `"auto"` (default)

## Configuración en Componentes

Los componentes ya están actualizados:
- `PoliciesNearExpirationContent`
- `PolicyOcrUpdateDialog`

Ambos usan automáticamente el endpoint `/api/ocr/extract` con fallback automático.

## Testing

### Test local con curl

```bash
# Fuerza OpenAI
curl -X POST http://localhost:3000/api/ocr/extract \
  -F "file=@poliza.pdf" \
  -F "clientId=test-123" \
  -F "provider=openai"

# Usa fallback automático
curl -X POST http://localhost:3000/api/ocr/extract \
  -F "file=@poliza.pdf" \
  -F "clientId=test-123"
```

### Debugging en console (F12)

```javascript
// Verás logs como:
// "Starting OCR extraction: {..., provider: 'auto'}"
// "Attempting OCR with OpenAI GPT-4o mini"
// "OpenAI response received: {model, inputTokens, outputTokens}"
// "OCR extraction successful: {..., provider: 'openai'}"
```

## Recomendación

**Configuración óptima por caso de uso:**

### 1️⃣ Máxima economía (Recomendado)
```bash
OPENAI_API_KEY=sk-...
```
- Usa GPT-4o mini (~$0.0005 por póliza)
- Sin fallback, pero es suficiente

### 2️⃣ Economía + Confiabilidad
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```
- Intenta GPT-4o mini primero
- Si falla, usa Claude como respaldo
- Costo promedio: ~$0.001 por póliza

### 3️⃣ Máxima confiabilidad
```bash
ANTHROPIC_API_KEY=sk-ant-...
```
- Usa solo Claude
- Mejor precisión
- Costo: ~$0.009 por póliza

## Monitoreo

En los logs del servidor verás:

```
Starting OCR extraction: {..., provider: 'auto'}
Attempting OCR with OpenAI GPT-4o mini: { fileName }
OpenAI response received: { model: 'gpt-4o-mini', inputTokens: 1234, outputTokens: 456 }
OCR extraction successful: {provider: 'openai', hasNumeroPoliza: true, ...}
```

O si falla:

```
Starting OCR extraction: {..., provider: 'auto'}
Attempting OCR with OpenAI GPT-4o mini: { fileName }
Provider openai failed: Rate limit exceeded
Attempting OCR with Mistral: { fileName }
Provider mistral failed: Not supported media type
Attempting OCR with Claude: { fileName }
Claude response received: { model: 'claude-3-5-sonnet-20241022', ... }
OCR extraction successful: {provider: 'claude', ...}
```

## Cambiar entre Providers

Para cambiar el orden de fallback:

En `/api/ocr/extract-multi/route.ts`, línea ~220:

```typescript
const providers: Array<'openai' | 'mistral' | 'claude'> = provider === 'auto'
  ? ['openai', 'mistral', 'claude']  // ← Cambiar orden aquí
  : [provider as 'openai' | 'mistral' | 'claude'];
```

Ejemplos de otros órdenes:

```typescript
['claude', 'openai', 'mistral']    // Claude primero, más confiable
['mistral', 'openai', 'claude']    // Mistral primero
['claude']                          // Solo Claude
```

## Errores Comunes

### "All OCR providers failed"
- Ningún provider tiene API key configurada
- **Solución:** Agregar al menos una API key a `.env.local`

### "OPENAI_API_KEY not configured"
- Intentó OpenAI pero no está configurada
- **Solución:** Agregar `OPENAI_API_KEY=sk-...` o cambiar orden de fallback

### "Mistral does not support PDF vision"
- Subiste PDF pero Mistral es el único provider disponible
- **Solución:** Convertir PDF a imagen, o agregar OpenAI/Claude

### "Rate limit exceeded"
- Se alcanzó el límite de rate limit de un provider
- **Solución:** Esperar, o agregar otro provider al fallback

## Costos Mensuales Estimados

Asumiendo 100 pólizas OCR por mes:

| Configuración | Costo/mes |
|----------------|-----------|
| **GPT-4o mini solo** | $0.05 USD 🎉 |
| GPT-4o mini + Claude | $0.10 USD |
| Solo Claude | $0.90 USD |

**Potencial de ahorro: ~95% usando GPT-4o mini**
