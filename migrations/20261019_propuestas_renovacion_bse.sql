-- Propuestas de renovación BSE
-- 1) % de aumento en renovación por cliente, en una tabla SOLO para la administración
--    (la tabla clients la puede leer el propio cliente desde su portal, y el % es interno).
-- 2) Tabla con cada propuesta generada (una por cliente y por export de BSE).
-- 3) Bucket PRIVADO para los PDF: solo el servidor (service role) lee y escribe;
--    al cliente le llega un link firmado que vence.
-- Todo es aditivo: no modifica ni borra datos existentes. Se puede correr más de una vez.

-- 1) % de aumento por cliente ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_renewal_settings (
  client_id UUID PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  aumento_renovacion_pct NUMERIC(5,2) NOT NULL DEFAULT 3
    CONSTRAINT client_renewal_settings_pct_rango CHECK (aumento_renovacion_pct >= 0 AND aumento_renovacion_pct <= 50),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_renewal_settings IS
  'Aumento a aplicar sobre el premio de la póliza al renovar (%), por cliente. Sin fila = 3 %. Solo admins.';

ALTER TABLE public.client_renewal_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gestionan aumentos de renovación" ON public.client_renewal_settings;
CREATE POLICY "Admins gestionan aumentos de renovación" ON public.client_renewal_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS client_renewal_settings_updated_at ON public.client_renewal_settings;
CREATE TRIGGER client_renewal_settings_updated_at
  BEFORE UPDATE ON public.client_renewal_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2) Propuestas -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.renewal_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source_filename TEXT,
  aumento_pct NUMERIC(5,2) NOT NULL,
  -- Detalle por póliza: [{policy_id, numero_poliza, numero_cotizacion, plan_pago, moneda,
  --   premio_poliza, premio_cotizacion, bonificacion_pct, premio_propuesto, estado, ...}]
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_actual NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_propuesto NUMERIC(14,2) NOT NULL DEFAULT 0,
  moneda TEXT NOT NULL DEFAULT 'UYU',
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'generada'
    CHECK (status IN ('generada', 'enviada', 'aprobada', 'rechazada', 'aplicada')),
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS renewal_proposals_client_idx
  ON public.renewal_proposals (client_id, created_at DESC);

ALTER TABLE public.renewal_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gestionan propuestas de renovación" ON public.renewal_proposals;
CREATE POLICY "Admins gestionan propuestas de renovación" ON public.renewal_proposals
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS renewal_proposals_updated_at ON public.renewal_proposals;
CREATE TRIGGER renewal_proposals_updated_at
  BEFORE UPDATE ON public.renewal_proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3) Bucket privado ----------------------------------------------------------------
-- Sin políticas sobre storage.objects para este bucket: nadie lo lee con la anon key.
-- El servidor sube y firma links con la service role. Si ya existiera, lo forzamos a privado.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('renewal-proposals', 'renewal-proposals', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false;
