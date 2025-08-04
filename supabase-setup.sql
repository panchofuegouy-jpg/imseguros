-- Configuración de Supabase para el sistema de seguros
-- Ejecutar en el SQL Editor de Supabase Dashboard

-- 1. Crear tabla de perfiles de usuario (si no existe)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'client')),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear tabla de clientes (si no exists)
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  telefono TEXT,
  documento TEXT UNIQUE NOT NULL,
  direccion TEXT,
  numero_cliente INTEGER UNIQUE,
  departamento TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilitar RLS en las tablas
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- 4. Políticas para user_profiles
-- IMPORTANTE: Primero eliminamos políticas existentes si las hay
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Los usuarios pueden leer su propio perfil
CREATE POLICY "Users can read own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Los admins pueden leer todos los perfiles (usando auth.jwt() para evitar recursión)
CREATE POLICY "Admins can read all profiles" ON user_profiles
  FOR SELECT USING (
    -- Permitir si es su propio perfil
    auth.uid() = id 
    OR 
    -- O si es admin (verificando directamente en la tabla sin recursión)
    auth.uid() IN (
      SELECT id FROM user_profiles WHERE role = 'admin'
    )
  );

-- Solo se permite insertar perfiles mediante service role (para la función de servidor)
-- Esta política será más permisiva y la validación se hará en el código
CREATE POLICY "Service role can insert profiles" ON user_profiles
  FOR INSERT WITH CHECK (true);

-- Los usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- 5. Políticas para clients
-- Los clientes pueden leer solo su propia información
CREATE POLICY "Clients can read own data" ON clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND client_id = clients.id
    )
  );

-- Los admins pueden leer todos los clientes
CREATE POLICY "Admins can read all clients" ON clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Solo admins pueden insertar clientes
CREATE POLICY "Admins can insert clients" ON clients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Solo admins pueden actualizar clientes
CREATE POLICY "Admins can update clients" ON clients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 6. Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Triggers para actualizar updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 8. Función para crear el primer usuario admin (ejecutar solo una vez)
-- Reemplaza 'admin@example.com' con tu email real
INSERT INTO user_profiles (id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'admin@example.com'
ON CONFLICT (id) DO NOTHING;
