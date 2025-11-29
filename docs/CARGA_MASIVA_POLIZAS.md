# Carga Masiva de Pólizas con OCR (n8n Webhook)

## Descripción

Esta funcionalidad permite cargar múltiples archivos de pólizas de seguros de forma simultánea, utilizando un webhook de n8n que procesa OCR (Reconocimiento Óptico de Caracteres) para extraer automáticamente los datos relevantes de cada póliza.

## Características

### 1. **Carga Múltiple de Archivos**
- Permite seleccionar varios archivos PDF o imágenes (PNG, JPG, JPEG) simultáneamente
- Cada archivo se procesa de forma independiente
- Visualización del progreso de cada archivo en tiempo real

### 2. **Extracción Automática de Datos con OCR (n8n)**
El sistema envía los archivos a un webhook de n8n que procesa OCR y extrae automáticamente:
- **Número de Póliza**: Detecta patrones como "Póliza 639864" o "POLIZA N° 639864"
- **Fechas de Vigencia**: Extrae inicio y fin de vigencia (formato DD/MM/YYYY)
- **Nombre del Asegurado**: Identifica el nombre de la persona asegurada
- **Tipo de Seguro**: Detecta el riesgo cubierto (ej: "GARANTÍA DE ALQUILER")
- **Aseguradora**: Identifica automáticamente la compañía de seguros mediante palabras clave

### 3. **Almacenamiento Organizado**
- Los archivos se suben a Supabase Storage en carpetas organizadas por cliente
- Cada póliza se guarda en la base de datos con:
  - URL del archivo original
  - Array de URLs (soporta múltiples archivos por póliza)
  - Datos extraídos por OCR
  - Notas con un extracto del texto reconocido

### 4. **Interfaz de Usuario Intuitiva**
- Indicadores visuales de estado para cada archivo:
  - ⏳ Pendiente
  - 🔄 Procesando OCR
  - ⬆️ Subiendo
  - ✅ Completado
  - ❌ Error
- Barra de progreso individual para cada archivo
- Previsualización de datos extraídos
- Opción de limpiar y reiniciar el proceso

## Uso

### Para Administradores

1. **Acceder al Cliente**
   - Navega a `/admin/clientes/[clientId]`
   - Verás el detalle del cliente con sus pólizas

2. **Iniciar Carga Masiva**
   - Haz clic en el botón "Cargar Pólizas"
   - Se abrirá un diálogo modal

3. **Seleccionar Archivos**
   - Haz clic en el selector de archivos
   - Selecciona uno o múltiples archivos (PDF, PNG, JPG, JPEG)
   - Los archivos aparecerán en la lista con estado "Pendiente"

4. **Procesar Archivos**
   - Haz clic en "Iniciar Carga"
   - El sistema procesará cada archivo:
     - Subirá el archivo a Storage
     - Ejecutará OCR para extraer texto
     - Analizará el texto para identificar datos
     - Creará el registro de póliza en la base de datos

5. **Revisar Resultados**
   - Cada archivo mostrará su estado y progreso
   - Los datos extraídos se mostrarán en una tarjeta
   - Si hay errores, se mostrarán en rojo

6. **Finalizar**
   - Una vez completado, la página se actualizará automáticamente
   - Las nuevas pólizas aparecerán en la tabla

## Datos Extraídos

### Ejemplo de Póliza (Sura)

Basándose en la póliza de muestra proporcionada, el sistema extrae:

```
Póliza: 639864
Aseguradora: Sura
Tipo: GARANTÍA DE ALQUILER
Asegurado: SALLES CASSANELLO, HÉCTOR ARIEL
Vigencia: 30/08/2025 a 30/08/2026
```

### Patrones de Reconocimiento

El sistema busca los siguientes patrones en el texto:

1. **Número de Póliza**
   - `Póliza 123456`
   - `POLIZA N° 123456`
   - `Póliza N° 123456`

2. **Vigencia**
   - `Vigencia DD/MM/YYYY a DD/MM/YYYY`
   - Convierte automáticamente a formato YYYY-MM-DD para la base de datos

3. **Asegurado**
   - `Asegurado NOMBRE APELLIDO`
   - Extrae hasta encontrar palabras clave como "Proponente" o "Suma"

4. **Tipo de Seguro**
   - `Riesgo Cubierto TIPO`
   - Extrae hasta encontrar la palabra "Asegurado"

5. **Aseguradora**
   - Búsqueda por palabras clave en el texto
   - Coincidencia con nombres de compañías en la base de datos
   - Mapeo especial para nombres comunes (ej: "sura", "mapfre", etc.)

## Estructura de Base de Datos

### Tabla `policies`

```sql
CREATE TABLE policies (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  company_id UUID REFERENCES companies(id),
  numero_poliza TEXT NOT NULL,
  tipo TEXT NOT NULL,
  vigencia_inicio DATE NOT NULL,
  vigencia_fin DATE NOT NULL,
  archivo_url TEXT,              -- URL del archivo principal
  archivo_urls TEXT[],            -- Array de URLs (múltiples archivos)
  notas TEXT,                     -- Incluye extracto del OCR
  nombre_asegurado TEXT,
  documento_asegurado TEXT,
  parentesco TEXT DEFAULT 'Titular',
  status VARCHAR(20) DEFAULT 'Pendiente',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Configuración

### 1. Configurar Webhook de n8n

El webhook de n8n ya está configurado en:
```
https://centro-n8n.xqnwvv.easypanel.host/webhook/75fb7c2d-82f0-4514-b137-6aee42432f42
```

Para más detalles sobre cómo configurar el workflow en n8n, consulta: [N8N_WEBHOOK_CONFIG.md](./N8N_WEBHOOK_CONFIG.md)

### 2. Variables de Entorno (Opcional)

Si deseas usar una URL diferente, configura en tu `.env.local`:

```bash
NEXT_PUBLIC_N8N_WEBHOOK_URL=tu-webhook-url
```

### 3. Migración de Base de Datos

Ejecuta el script SQL en Supabase:

```bash
/migrations/ensure_policies_table_complete.sql
```

### 4. Configuración de Storage

Asegúrate de tener el bucket `policy-documents` configurado en Supabase Storage con las políticas de acceso apropiadas.

## Mejoras Futuras

- [ ] Soporte para más formatos de pólizas
- [ ] Entrenamiento de modelos personalizados para mejor precisión
- [ ] Validación y corrección manual de datos extraídos
- [ ] Detección automática de duplicados
- [ ] Extracción de montos y coberturas
- [ ] Soporte para pólizas en otros idiomas
- [ ] Integración con APIs de aseguradoras para validación

## Notas Técnicas

### Rendimiento
- El OCR se procesa en el servidor de n8n (no en el navegador del usuario)
- Los archivos se suben primero a Supabase Storage
- El webhook de n8n recibe la URL del archivo y lo procesa
- Cada archivo se procesa secuencialmente para mejor control de errores

### Limitaciones
- La precisión del OCR depende de la calidad de la imagen/PDF y del servicio configurado en n8n
- El webhook debe responder en un tiempo razonable (< 30 segundos recomendado)
- Se recomienda usar archivos de buena calidad y resolución

### Arquitectura
1. Usuario selecciona archivos en el navegador
2. Archivos se suben a Supabase Storage
3. Se envía FormData al webhook de n8n con el archivo y su URL
4. n8n procesa OCR y extrae datos
5. n8n retorna JSON con datos extraídos
6. Frontend crea registro de póliza en Supabase
7. Usuario ve progreso y resultados en tiempo real

## Soporte

Para problemas o mejoras, contacta al equipo de desarrollo.
