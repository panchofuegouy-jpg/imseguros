-- Agregar campos de facturación a la tabla policies
-- Permite registrar cuánto se factura por cada póliza

DO $$
BEGIN
  -- Monto de la prima (importe facturado)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='policies' AND column_name='prima_monto') THEN
    ALTER TABLE policies ADD COLUMN prima_monto NUMERIC(12, 2);
  END IF;

  -- Moneda (UYU, USD, etc.)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='policies' AND column_name='moneda') THEN
    ALTER TABLE policies ADD COLUMN moneda TEXT DEFAULT 'UYU';
  END IF;

  -- Frecuencia/forma de pago (Mensual, Trimestral, Semestral, Anual)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='policies' AND column_name='forma_pago') THEN
    ALTER TABLE policies ADD COLUMN forma_pago TEXT;
  END IF;

  -- Número de factura o recibo
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='policies' AND column_name='numero_factura') THEN
    ALTER TABLE policies ADD COLUMN numero_factura TEXT;
  END IF;
END $$;
