# Funcionalidad de Cambio de Contraseña en Primer Login

## Descripción

Esta funcionalidad obliga a los clientes a cambiar su contraseña temporal cuando ingresan por primera vez al sistema, mejorando la seguridad de la aplicación.

## Flujo de Funcionamiento

### 1. Creación de Cliente (Admin)
- El admin crea un nuevo cliente a través del formulario
- Se genera automáticamente una contraseña temporal aleatoria
- Se marca al usuario con `first_login: true` en la base de datos
- Se envía un email con las credenciales temporales

### 2. Primer Login del Cliente
- El cliente ingresa con su email y contraseña temporal
- El sistema detecta que `first_login: true`
- Se muestra automáticamente un modal **no cancelable** para cambiar la contraseña

### 3. Cambio de Contraseña
- El cliente debe crear una nueva contraseña que cumpla con los requisitos de seguridad:
  - Al menos 8 caracteres
  - Una letra mayúscula
  - Una letra minúscula
  - Un número
  - Un carácter especial
- Las contraseñas deben coincidir
- Una vez cambiada exitosamente, se marca `first_login: false`

### 4. Acceso Normal
- En futuros inicios de sesión, el cliente accede normalmente sin el modal

## Componentes y Archivos Modificados

### Base de Datos
- **Migración**: `migrations/add_first_login_field.sql`
  - Agrega campo `first_login BOOLEAN DEFAULT TRUE` a `user_profiles`
  - Establece `first_login: false` para usuarios admin existentes

### Componentes
- **`components/change-password-dialog.tsx`**: Modal para cambio de contraseña
  - Validación de contraseña en tiempo real
  - Indicadores visuales de requisitos
  - Manejo de errores y estados de carga

### Hooks
- **`hooks/use-first-login.ts`**: Hook personalizado
  - Detecta si el usuario requiere cambio de contraseña
  - Gestiona el estado de primer login

### Layouts
- **`components/client-layout.tsx`**: Actualizado para mostrar el modal
  - Integra el hook `useFirstLogin`
  - Muestra el modal automáticamente cuando es necesario

### Autenticación
- **`lib/auth.ts`**: Actualizado para incluir `first_login` en el perfil
- **`lib/auth-server.ts`**: Establece `first_login: true` para nuevos clientes

## Requisitos de Contraseña

La nueva contraseña debe cumplir con los siguientes requisitos:

1. **Longitud**: Mínimo 8 caracteres
2. **Mayúscula**: Al menos una letra mayúscula (A-Z)
3. **Minúscula**: Al menos una letra minúscula (a-z)
4. **Número**: Al menos un dígito (0-9)
5. **Especial**: Al menos un carácter especial (!@#$%^&*(),.?":{}|<>)

## Experiencia de Usuario

### Indicadores Visuales
- ✅ **Verde**: Requisito cumplido
- ❌ **Rojo**: Requisito no cumplido
- 🔘 **Gris**: Estado neutro (sin texto ingresado)

### Estados del Modal
1. **Formulario**: Permite ingresar y confirmar nueva contraseña
2. **Cargando**: Muestra "Cambiando..." durante el proceso
3. **Éxito**: Confirmación con animación antes de cerrar

### Seguridad
- El modal **no se puede cerrar** hasta completar el cambio
- No hay botón de cancelar o cerrar
- Previene el acceso al sistema hasta cambiar la contraseña

## Ejecución de la Migración

Para activar esta funcionalidad en el entorno de producción:

```sql
-- Ejecutar en Supabase SQL Editor
-- Migration: Add first_login field to user_profiles table

-- Add the first_login column to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS first_login BOOLEAN DEFAULT TRUE;

-- Set existing admin users to first_login = FALSE
UPDATE user_profiles 
SET first_login = FALSE 
WHERE role = 'admin';

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_first_login 
ON user_profiles(first_login) 
WHERE first_login = TRUE;
```

## Casos de Uso

### Nuevo Cliente
1. Admin crea cliente → `first_login: true`
2. Cliente recibe email con credenciales temporales
3. Cliente hace login → Modal aparece automáticamente
4. Cliente cambia contraseña → `first_login: false`
5. Acceso normal en futuros logins

### Cliente Existente
- Los clientes existentes mantienen `first_login: false`
- No se ven afectados por esta funcionalidad

### Admin
- Los usuarios admin siempre tienen `first_login: false`
- No necesitan cambiar contraseña en primer login

## Consideraciones Técnicas

- **Performance**: Index en `first_login` para consultas rápidas
- **Security**: Validación tanto en frontend como backend
- **UX**: Modal responsivo y accesible
- **Error Handling**: Manejo robusto de errores de red y validación
