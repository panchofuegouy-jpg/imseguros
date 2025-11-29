# Resumen de Implementación: Carga Masiva de Pólizas con OCR

## ✅ Implementación Completada

### 1. Componente Principal
**Archivo**: `/components/multi-file-policy-uploader.tsx`

Componente React que permite:
- Selección múltiple de archivos (PDF, PNG, JPG, JPEG)
- Subida a Supabase Storage
- Envío al webhook de n8n para procesamiento OCR
- Visualización de progreso en tiempo real
- Creación automática de registros de pólizas

### 2. Integración con Cliente
**Archivo**: `/components/client-detail-page-content.tsx`

Se agregó el botón "Cargar Pólizas" en la página de detalle del cliente que abre el modal de carga masiva.

### 3. Migración de Base de Datos
**Archivo**: `/migrations/ensure_policies_table_complete.sql`

Script SQL que asegura que la tabla `policies` tenga todas las columnas necesarias:
- `archivo_urls` (TEXT[]): Array para múltiples archivos
- `nombre_asegurado`, `documento_asegurado`, `parentesco`
- `status`: Estado de la póliza
- Índices para mejor rendimiento
- Políticas RLS configuradas

### 4. Documentación
**Archivos creados**:
- `/docs/CARGA_MASIVA_POLIZAS.md`: Guía completa de uso
- `/docs/N8N_WEBHOOK_CONFIG.md`: Configuración del webhook n8n

### 5. API Route (Placeholder)
**Archivo**: `/app/api/policies/ocr/route.ts`

Ruta API preparada para futuras integraciones con servicios de OCR del lado del servidor.

## 🔧 Configuración Necesaria

### Webhook de n8n
```
URL: https://centro-n8n.xqnwvv.easypanel.host/webhook/75fb7c2d-82f0-4514-b137-6aee42432f42
```

El webhook está hardcodeado en el componente como fallback, pero puede configurarse via variable de entorno.

### Variables de Entorno (Opcional)
Agregar a `.env.local`:
```bash
NEXT_PUBLIC_N8N_WEBHOOK_URL=https://centro-n8n.xqnwvv.easypanel.host/webhook/75fb7c2d-82f0-4514-b137-6aee42432f42
```

## 📋 Pasos para Usar

### Para el Usuario Final (Admin):

1. **Acceder al cliente**
   - Ir a `/admin/clientes/[clientId]`

2. **Abrir carga masiva**
   - Click en botón "Cargar Pólizas" (al lado de "Crear Nueva Póliza")

3. **Seleccionar archivos**
   - Click en el input de archivos
   - Seleccionar uno o múltiples PDFs/imágenes

4. **Iniciar proceso**
   - Click en "Iniciar Carga"
   - Ver progreso en tiempo real

5. **Revisar resultados**
   - Ver datos extraídos por cada archivo
   - Verificar pólizas creadas en la tabla

### Para el Desarrollador (Configurar n8n):

El workflow de n8n debe:

1. **Recibir el FormData** con:
   - `file`: El archivo
   - `fileUrl`: URL en Supabase
   - `clientId`: UUID del cliente
   - `fileName`: Nombre del archivo

2. **Procesar OCR** usando el servicio preferido:
   - Google Cloud Vision
   - AWS Textract
   - Azure Computer Vision
   - Tesseract
   - Otro

3. **Extraer datos** con patrones regex o AI:
   - Número de póliza
   - Tipo de seguro
   - Fechas de vigencia (DD/MM/YYYY → YYYY-MM-DD)
   - Nombre del asegurado
   - Compañía de seguros

4. **Retornar JSON**:
```json
{
  "extractedData": {
    "numero_poliza": "639864",
    "tipo": "GARANTÍA DE ALQUILER",
    "vigencia_inicio": "2025-08-30",
    "vigencia_fin": "2026-08-30",
    "nombre_asegurado": "NOMBRE COMPLETO",
    "documento_asegurado": "12345678",
    "parentesco": "Titular",
    "company_id": "uuid-opcional",
    "notas": "Texto adicional"
  }
}
```

## 🗄️ Estructura de Base de Datos

### Tabla `policies`
```sql
- id: UUID
- client_id: UUID (FK a clients)
- company_id: UUID (FK a companies, nullable)
- numero_poliza: TEXT
- tipo: TEXT
- vigencia_inicio: DATE
- vigencia_fin: DATE
- archivo_url: TEXT (URL principal)
- archivo_urls: TEXT[] (Array de URLs)
- nombre_asegurado: TEXT
- documento_asegurado: TEXT
- parentesco: TEXT (default: 'Titular')
- status: VARCHAR(20)
- notas: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## 🎯 Características Implementadas

✅ Selección múltiple de archivos
✅ Subida a Supabase Storage organizada por cliente
✅ Integración con webhook n8n
✅ Indicadores visuales de progreso
✅ Manejo de errores por archivo
✅ Previsualización de datos extraídos
✅ Creación automática de pólizas
✅ Soporte para PDF e imágenes
✅ Documentación completa
✅ Migración SQL idempotente

## 📝 Próximos Pasos

1. **Ejecutar migración SQL** en Supabase
2. **Configurar workflow en n8n** según especificaciones
3. **Probar con póliza de ejemplo** proporcionada
4. **Ajustar patrones de extracción** según necesidad
5. **Configurar mapeo de compañías** en n8n

## 🔍 Testing

Para probar el webhook de n8n directamente:

```bash
curl -X POST https://centro-n8n.xqnwvv.easypanel.host/webhook/75fb7c2d-82f0-4514-b137-6aee42432f42 \
  -F "file=@/path/to/poliza.pdf" \
  -F "fileUrl=https://example.com/poliza.pdf" \
  -F "clientId=uuid-test" \
  -F "fileName=poliza.pdf"
```

## 📚 Archivos Modificados/Creados

### Nuevos:
- `/components/multi-file-policy-uploader.tsx`
- `/migrations/ensure_policies_table_complete.sql`
- `/docs/CARGA_MASIVA_POLIZAS.md`
- `/docs/N8N_WEBHOOK_CONFIG.md`
- `/app/api/policies/ocr/route.ts`

### Modificados:
- `/components/client-detail-page-content.tsx` (agregado botón de carga masiva)

## 🎨 UI/UX

- Modal responsive con scroll
- Tarjetas individuales por archivo
- Badges de estado con colores
- Barras de progreso animadas
- Mensajes de error claros
- Opción de limpiar y reiniciar
- Contador de archivos completados
- Previsualización de datos extraídos

## 🔐 Seguridad

- Solo administradores pueden cargar pólizas
- Archivos se suben a Storage con permisos apropiados
- Validación de tipos de archivo
- Manejo seguro de errores
- RLS configurado en todas las tablas

---

**Estado**: ✅ Implementación completa y lista para testing
**Próximo paso**: Configurar workflow en n8n y ejecutar migración SQL
