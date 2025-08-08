-- Migration para hacer el campo email opcional en la tabla clients
-- Ejecutar este script si ya tienes una base de datos con datos existentes

-- 1. Hacer el campo email opcional (permitir NULL)
ALTER TABLE clients ALTER COLUMN email DROP NOT NULL;

-- 2. Verificar la migración
SELECT 
  column_name, 
  is_nullable, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'clients' 
  AND column_name = 'email';

-- Este query debería mostrar is_nullable = 'YES' después de la migración
