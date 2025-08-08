-- Agregar columna de estado a la tabla policies
ALTER TABLE policies 
ADD COLUMN status VARCHAR(20) DEFAULT 'Pendiente' 
CHECK (status IN ('Pendiente', 'Contactado', 'En Proceso', 'Renovada', 'No Renovada'));

-- Crear índice para mejorar el rendimiento de consultas por estado
CREATE INDEX idx_policies_status ON policies(status);

-- Actualizar todas las pólizas existentes con estado 'Pendiente'
UPDATE policies SET status = 'Pendiente' WHERE status IS NULL;
