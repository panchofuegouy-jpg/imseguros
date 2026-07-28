# Debugging OCR Data Extraction

## Síntomas

Los datos del OCR no se están completando correctamente en `/admin/polizas/por-vencer`.

## Flujo de Datos

```
Cliente (navegador)
    ↓
[handleOcrFileChange] en policies-near-expiration-content.tsx
    ↓
POST /api/ocr-webhook
    ↓
[ocr-webhook/route.ts] - genera signed URL y reenvía a n8n
    ↓
n8n workflow - hace OCR y devuelve datos
    ↓
[parseOcrData] en lib/parse-ocr-data.ts - extrae datos del response
    ↓
[setFormData] - completa el formulario
```

## Cómo Debuggear

### 1. Abrir la consola del navegador (F12)

En la pestaña "Console", ejecuta cuando hagas OCR:
```javascript
// Verás logs como:
// "OCR extraction result: {extractedKeys: ['numero_poliza', 'tipo', ...], ...}"
```

**¿Qué buscar?**
- Si `extractedKeys` está vacío o solo tiene 1-2 campos → El parser no está extrayendo datos
- Si `hasNumeroPoliza`, `hasTipo`, `hasVigencia` son `false` → n8n no extrajo esos campos

### 2. Revisar la respuesta de n8n

En Network tab (F12), busca la request a `/api/ocr-webhook`:
- **Response tab**: Verás qué devolvió n8n

**¿Qué estructura debería verse?**

**Opción A - Formato correcto (con extractedData):**
```json
{
  "extractedData": {
    "numero_poliza": "639864",
    "tipo": "GARANTÍA DE ALQUILER",
    "vigencia_inicio": "2025-08-30",
    ...
  }
}
```

**Opción B - Formato Claude API (output[0].content[0].text):**
```json
{
  "output": [
    {
      "content": [
        {
          "text": "{\"numero_poliza\": \"639864\", ...}"
        }
      ]
    }
  ]
}
```

**Opción C - Error (inesperado):**
```json
{
  "error": "...",
  "status": 500
}
```

### 3. Ver los logs del servidor

En la consola del servidor Next.js, verás:
```
N8N response received: {
  hasOutput: true/false,
  outputLength: 1,
  dataKeys: ['output', 'code', ...],
  hasExtractedData: true/false,
  hasData: true/false
}
Claude API response text (first 500 chars): {...}
```

## Problemas Comunes y Soluciones

### Problema 1: n8n devuelve error

**Síntoma:** Response tiene `{ "error": "..." }` o `status !== 200`

**Posibles causas:**
- La URL del archivo no es accesible desde n8n
- El workflow de OCR falló (problema con Claude API, Vision API, etc.)
- n8n no tiene permisos para acceder a la URL

**Solución:**
1. Verificar que `N8N_WEBHOOK_SECRET` esté configurado correctamente
2. Verificar que la URL firmada (signed URL) sea válida
3. Revisar los logs de n8n en el panel de admin

### Problema 2: n8n devuelve datos pero en estructura incorrecta

**Síntoma:** 
- Console muestra `extractedKeys: []` (vacío)
- O solo tiene 1-2 campos en lugar de 10+

**Posibles causas:**
- n8n devuelve el JSON dentro de `output[0].content[0].text` como string
- El JSON tiene backticks o markdown: `{\"json\": \"...\"}`
- El JSON viene dentro de un campo anidado no esperado

**Verificación:**
En Network tab, abre la response de `/api/ocr-webhook` y busca:
- ¿Está el JSON entre comillas? → String, necesita parseo
- ¿Tiene ```json```? → Markdown, parseador debe removerlo
- ¿Está anidado bajo otra key? → Parseador debe buscarlo

**Solución:**
El nuevo parseador (actualizado) debería manejar:
- ✅ JSON entre backticks
- ✅ JSON dentro de `output[0].content[0].text`
- ✅ JSON dentro de `extractedData`
- ✅ Múltiples niveles de anidación

Si aún falla, agregar más rutas en el parseador.

### Problema 3: n8n extrae datos pero campos vacíos

**Síntoma:**
- Console muestra `extractedKeys: ['numero_poliza', 'tipo', 'vigencia_inicio', ...]`
- Pero `hasNumeroPoliza: false` (el campo existe pero es null/vacío)

**Posibles causas:**
- El prompt de n8n no está extrayendo correctamente
- El OCR no logró leer ciertos campos del PDF/imagen
- Valores `null` en lugar de strings

**Solución:**
1. Revisar el prompt OCR en `/docs/ocr-prompt.md`
2. Testear n8n manualmente con un PDF de prueba
3. Verificar que el PDF sea legible (no escaneado de mala calidad, etc.)

### Problema 4: Números no se parsean correctamente

**Síntoma:**
- `prima_monto` siempre es 0 o vacío
- El monto está en el PDF pero no se extrae

**Posibles causas:**
- El campo se llama diferente en n8n: `total_a_pagar`, `monto`, `premio`, etc.
- Formato con símbolo de moneda o miles: "$1.234,50"
- El parseador de números no limpia correctamente

**Verificación:**
En console, busca el log y revisa qué valores tiene `ext.total_a_pagar`, `ext.prima_monto`, etc.

**Solución:**
El código ya intenta múltiples nombres:
```typescript
ext.total_a_pagar ?? ext.prima_monto ?? ext.prima ?? ext.monto ?? ext.importe ?? ext.premio
```

Si el campo tiene otro nombre, agregar a esta lista.

## Script de Test Rápido

Ejecutar en la consola del navegador mientras procesa OCR:

```javascript
// Interceptar fetch y loguear
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const result = originalFetch.apply(this, args);
  if (args[0].includes('ocr-webhook')) {
    result.then(r => r.json()).then(data => {
      console.log('=== OCR WEBHOOK RESPONSE ===');
      console.log(JSON.stringify(data, null, 2));
      console.log('=== END ===');
    });
  }
  return result;
};
```

Luego hacer OCR, y el response completo aparecerá en console.

## Checklist de Diagnóstico

- [ ] Abierto F12 → Console tab
- [ ] Hecho OCR en `/admin/polizas/por-vencer`
- [ ] Visto logs en Console con "OCR extraction result"
- [ ] Verificado Network tab → request a `/api/ocr-webhook`
- [ ] Revisado la response JSON completa
- [ ] Comparado con formatos esperados en "¿Qué estructura debería verse?"
- [ ] Identificado si el problema está en n8n o en el parseador

## Escalada

Si después de revisar todo esto el problema persiste:

1. **Problema claramente en n8n:**
   - Los datos no se extraen o vienen en formato inesperado
   - Solución: Ajustar workflow n8n o prompt Claude

2. **Problema claramente en el parseador:**
   - n8n devuelve datos correctamente pero la aplicación no los detecta
   - Solución: Agregar más rutas de búsqueda en `parseOcrData()`

3. **Problema en normalización:**
   - Datos se extraen pero no se completan en el formulario
   - Problema en `normalizeOcrDate()` u otro normalizador
   - Solución: Revisar `/lib/ocr-date.ts`
