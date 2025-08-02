# Configuración: Creación Automática de Clientes con Envío de Email

Este documento explica cómo configurar el sistema para que cuando un admin cree un cliente desde el frontend, se genere automáticamente un usuario con rol "cliente" y se envíen las credenciales por email.

## ✅ Funcionalidades Implementadas

1. **Verificación de rol admin**: Solo usuarios con rol "admin" pueden crear clientes
2. **Creación automática de usuario**: Se crea un usuario en Supabase Auth con rol "cliente"
3. **Envío automático de email**: Se envían las credenciales al email del cliente usando SendGrid
4. **Interfaz mejorada**: El frontend muestra el estado del envío del email

## 🔧 Configuración Necesaria

### 1. Variables de Entorno

Crea un archivo `.env.local` basado en `.env.local.example`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# SendGrid Configuration
SENDGRID_API_KEY=tu_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@tudominio.com
```

**Importante**: 
- `SUPABASE_SERVICE_ROLE_KEY` es necesaria para usar `supabase.auth.admin.createUser()`
- `SENDGRID_FROM_EMAIL` debe ser un email verificado en SendGrid

### 2. Configuración en Supabase Dashboard

#### a) Ejecutar el Script SQL
1. Ve a tu proyecto de Supabase → **SQL Editor**
2. Ejecuta el contenido del archivo `supabase-setup.sql`
3. Esto creará las tablas y políticas de seguridad necesarias

#### b) Configurar Service Role Key
1. Ve a **Settings** → **API**
2. Copia la **service_role key** (no la anon key)
3. Agrégala como `SUPABASE_SERVICE_ROLE_KEY` en tu `.env.local`

#### c) Crear tu Usuario Admin
1. En el archivo `supabase-setup.sql`, reemplaza `'admin@example.com'` con tu email real
2. Primero regístrate normalmente en tu aplicación con ese email
3. Luego ejecuta la parte final del script SQL para asignarte el rol admin

### 3. Configuración de SendGrid

#### a) Crear Cuenta y API Key
1. Ve a [SendGrid](https://sendgrid.com/) y crea una cuenta
2. Ve a **Settings** → **API Keys**
3. Crea una nueva API Key con permisos de envío de email
4. Agrégala como `SENDGRID_API_KEY` en tu `.env.local`

#### b) Verificar Dominio/Email
1. Ve a **Settings** → **Sender Authentication**
2. Verifica tu dominio o al menos el email que usarás como remitente
3. Usa ese email verificado como `SENDGRID_FROM_EMAIL`

## 🚀 Cómo Funciona

### Flujo Completo

1. **Admin crea cliente**: Un usuario con rol "admin" llena el formulario de crear cliente
2. **Verificación de permisos**: La API verifica que el usuario tenga rol "admin"
3. **Creación en BD**: Se crea el registro del cliente en la tabla `clients`
4. **Creación de usuario**: Se crea automáticamente un usuario en Supabase Auth
5. **Perfil de usuario**: Se crea un perfil vinculando al cliente con rol "client"
6. **Envío de email**: Se envía un email con las credenciales usando SendGrid
7. **Respuesta al frontend**: Se informa si el email se envió exitosamente

### Estructura de Email

El email incluye:
- Saludo personalizado con el nombre del cliente
- Credenciales de acceso (email y contraseña temporal)
- Instrucciones para cambiar la contraseña
- Diseño profesional con estilos CSS

## 🔍 Verificación

### Comprobar que Todo Funciona

1. **Base de datos**: Verifica que las tablas `clients` y `user_profiles` existen
2. **Roles**: Asegúrate de tener al menos un usuario con rol "admin"
3. **Variables**: Comprueba que todas las variables de entorno están configuradas
4. **SendGrid**: Verifica que puedes enviar emails de prueba desde SendGrid

### Prueba de Funcionamiento

1. Inicia sesión con un usuario admin
2. Ve a la sección de clientes
3. Crea un nuevo cliente
4. Verifica que:
   - Se crea el cliente en la base de datos
   - Se crea el usuario en Supabase Auth
   - Se envía el email (revisa bandeja de entrada y spam)
   - El frontend muestra el estado del envío

## 🐛 Resolución de Problemas

### Error: "No autorizado"
- Verifica que tu usuario tenga rol "admin" en la tabla `user_profiles`

### Error: "Solo los administradores pueden crear clientes"
- Asegúrate de estar logueado con un usuario admin
- Verifica las políticas RLS en la base de datos

### Error al crear usuario en Supabase
- Verifica que `SUPABASE_SERVICE_ROLE_KEY` esté configurada correctamente
- Asegúrate de usar la service role key, no la anon key

### Email no se envía
- Verifica que `SENDGRID_API_KEY` esté configurada
- Asegúrate de que `SENDGRID_FROM_EMAIL` esté verificado en SendGrid
- Revisa los logs de la consola para errores específicos

### RLS Policies fallan
- Ejecuta completamente el script `supabase-setup.sql`
- Verifica que las políticas se crearon correctamente en Supabase Dashboard

## 📁 Archivos Modificados/Creados

- `app/api/create-client/route.ts` - API endpoint con verificación de admin
- `lib/auth-server.ts` - Función mejorada para crear clientes y enviar emails
- `components/create-client-dialog.tsx` - Frontend con indicadores de estado
- `supabase-setup.sql` - Script de configuración de base de datos
- `.env.local.example` - Ejemplo de variables de entorno

## 🎯 Próximos Pasos Recomendados

1. **Personalizar email**: Ajusta el template del email según tu marca
2. **Logs de auditoría**: Considera agregar logs de quién crea qué clientes
3. **Notificaciones**: Agregar notificaciones toast en el frontend
4. **Validaciones**: Mejorar validaciones de formulario
5. **Recuperación de contraseña**: Implementar flujo para reset de passwords
