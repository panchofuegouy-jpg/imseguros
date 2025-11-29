# Configuración del Webhook n8n para OCR

## URL del Webhook
```
https://centro-n8n.xqnwvv.easypanel.host/webhook/75fb7c2d-82f0-4514-b137-6aee42432f42
```

## Configuración en el Proyecto

Agrega esta variable de entorno a tu archivo `.env.local`:

```bash
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://centro-n8n.xqnwvv.easypanel.host/webhook/75fb7c2d-82f0-4514-b137-6aee42432f42
```

## Formato de Request al Webhook

El componente `MultiFilePolicyUploader` envía un `FormData` con los siguientes campos:

```javascript
{
  file: File,              // El archivo PDF o imagen
  fileUrl: string,         // URL pública del archivo en Supabase Storage
  clientId: string,        // UUID del cliente
  fileName: string         // Nombre original del archivo
}
```

## Formato de Response Esperado del Webhook

El webhook de n8n debe retornar un JSON con la siguiente estructura:

```json
{
  "extractedData": {
    "numero_poliza": "639864",
    "tipo": "GARANTÍA DE ALQUILER",
    "vigencia_inicio": "2025-08-30",
    "vigencia_fin": "2026-08-30",
    "nombre_asegurado": "SALLES CASSANELLO, HÉCTOR ARIEL",
    "documento_asegurado": "12345678",
    "parentesco": "Titular",
    "company_id": "uuid-de-la-compania",  // Opcional
    "notas": "Información adicional extraída"  // Opcional
  }
}
```

## Campos que el Workflow n8n Debe Extraer

### Obligatorios
- `numero_poliza`: Número de la póliza (string)
- `tipo`: Tipo de seguro (string)
- `vigencia_inicio`: Fecha de inicio en formato YYYY-MM-DD
- `vigencia_fin`: Fecha de fin en formato YYYY-MM-DD

### Opcionales
- `nombre_asegurado`: Nombre del asegurado
- `documento_asegurado`: Documento de identidad
- `parentesco`: Relación con el titular (default: "Titular")
- `company_id`: UUID de la compañía de seguros (si se puede identificar)
- `notas`: Notas adicionales o texto extraído

## Ejemplo de Workflow n8n

Tu workflow en n8n debería:

1. **Recibir el archivo** del webhook
2. **Procesar OCR** usando:
   - Google Cloud Vision API
   - AWS Textract
   - Azure Computer Vision
   - Tesseract (servidor)
   - O cualquier otro servicio de OCR
3. **Extraer datos** usando expresiones regulares o AI:
   - Buscar patrones como "Póliza N° XXXXXX"
   - Extraer fechas en formato DD/MM/YYYY
   - Identificar nombres y tipos de seguro
4. **Formatear respuesta** según el schema esperado
5. **Retornar JSON** con los datos extraídos

## Ejemplo de Patrones de Extracción

### Número de Póliza
```regex
/P[oó]liza\s+(?:N[°º]\s*)?(\d+)/i
```

### Vigencia
```regex
/Vigencia\s+(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/i
```

### Asegurado
```regex
/Asegurado\s+([^Proponente|Suma]+)/i
```

### Tipo de Seguro
```regex
/Riesgo\s+Cubierto\s+([^Asegurado]+)/i
```

## Mapeo de Compañías

Si detectas el nombre de una compañía en el texto, puedes mapearla a su UUID:

```javascript
const companyMapping = {
  'sura': 'uuid-sura',
  'mapfre': 'uuid-mapfre',
  'bse': 'uuid-bse',
  // ... etc
}
```

## Testing del Webhook

Puedes probar el webhook con curl:

```bash
curl -X POST https://centro-n8n.xqnwvv.easypanel.host/webhook/75fb7c2d-82f0-4514-b137-6aee42432f42 \
  -F "file=@/path/to/poliza.pdf" \
  -F "fileUrl=https://example.com/poliza.pdf" \
  -F "clientId=uuid-cliente" \
  -F "fileName=poliza.pdf"
```

## Manejo de Errores

Si el webhook falla o retorna un error, el componente mostrará:
- El archivo en estado de error
- El mensaje de error devuelto
- Opción de reintentar

## Notas de Implementación

- El webhook debe responder en menos de 30 segundos
- Si el procesamiento toma más tiempo, considera usar un sistema de cola
- Asegúrate de que el webhook esté accesible públicamente
- Implementa autenticación si es necesario (bearer token, API key, etc.)
