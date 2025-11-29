-- Asegurar que la tabla policies existe con todas las columnas necesarias
-- Esta migración es idempotente y puede ejecutarse múltiples veces

-- Crear la tabla si no existe
CREATE TABLE IF NOT EXISTS policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  numero_poliza TEXT NOT NULL,
  tipo TEXT NOT NULL,
  vigencia_inicio DATE NOT NULL,
  vigencia_fin DATE NOT NULL,
  archivo_url TEXT,
  archivo_urls TEXT[],
  notas TEXT,
  nombre_asegurado TEXT,
  documento_asegurado TEXT,
  parentesco TEXT DEFAULT 'Titular',
  status VARCHAR(20) DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'Contactado', 'En Proceso', 'Renovada', 'No Renovada')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agregar columnas si no existen (para bases de datos existentes)
DO $$ 
BEGIN
  -- Agregar archivo_urls si no existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='policies' AND column_name='archivo_urls') THEN
    ALTER TABLE policies ADD COLUMN archivo_urls TEXT[];
  END IF;

  -- Agregar nombre_asegurado si no existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='policies' AND column_name='nombre_asegurado') THEN
    ALTER TABLE policies ADD COLUMN nombre_asegurado TEXT;
  END IF;

  -- Agregar documento_asegurado si no existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='policies' AND column_name='documento_asegurado') THEN
    ALTER TABLE policies ADD COLUMN documento_asegurado TEXT;
  END IF;

  -- Agregar parentesco si no existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='policies' AND column_name='parentesco') THEN
    ALTER TABLE policies ADD COLUMN parentesco TEXT DEFAULT 'Titular';
  END IF;

  -- Agregar status si no existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='policies' AND column_name='status') THEN
    ALTER TABLE policies ADD COLUMN status VARCHAR(20) DEFAULT 'Pendiente' 
      CHECK (status IN ('Pendiente', 'Contactado', 'En Proceso', 'Renovada', 'No Renovada'));
  END IF;

  -- Agregar updated_at si no existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='policies' AND column_name='updated_at') THEN
    ALTER TABLE policies ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_policies_client_id ON policies(client_id);
CREATE INDEX IF NOT EXISTS idx_policies_company_id ON policies(company_id);
CREATE INDEX IF NOT EXISTS idx_policies_vigencia_fin ON policies(vigencia_fin);
CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);
CREATE INDEX IF NOT EXISTS idx_policies_numero_poliza ON policies(numero_poliza);

-- Habilitar RLS si no está habilitado
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para policies
-- Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Clients can read own policies" ON policies;
DROP POLICY IF EXISTS "Admins can read all policies" ON policies;
DROP POLICY IF EXISTS "Admins can insert policies" ON policies;
DROP POLICY IF EXISTS "Admins can update policies" ON policies;
DROP POLICY IF EXISTS "Admins can delete policies" ON policies;

-- Los clientes pueden leer solo sus propias pólizas
CREATE POLICY "Clients can read own policies" ON policies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND client_id = policies.client_id
    )
  );

-- Los admins pueden leer todas las pólizas
CREATE POLICY "Admins can read all policies" ON policies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Solo admins pueden insertar pólizas
CREATE POLICY "Admins can insert policies" ON policies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Solo admins pueden actualizar pólizas
CREATE POLICY "Admins can update policies" ON policies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Solo admins pueden eliminar pólizas
CREATE POLICY "Admins can delete policies" ON policies
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_policies_updated_at ON policies;
CREATE TRIGGER update_policies_updated_at
  BEFORE UPDATE ON policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Crear tabla companies si no existe
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS en companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Políticas para companies (todos pueden leer, solo admins pueden modificar)
DROP POLICY IF EXISTS "Everyone can read companies" ON companies;
DROP POLICY IF EXISTS "Admins can insert companies" ON companies;
DROP POLICY IF EXISTS "Admins can update companies" ON companies;
DROP POLICY IF EXISTS "Admins can delete companies" ON companies;

CREATE POLICY "Everyone can read companies" ON companies
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert companies" ON companies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update companies" ON companies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete companies" ON companies
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger para actualizar updated_at en companies
DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
