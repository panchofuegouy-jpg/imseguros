-- =====================================================================
-- Siniestros + Cobranza + Cumpleaños  (portado desde segu/tupoliza)
-- =====================================================================
-- segu es multi-tenant: cada tabla lleva broker_id y la autorización pasa
-- por broker_members. imseguros es de un solo corredor, así que acá el
-- tenant desaparece y el permiso es simplemente "ser admin".
--
-- Idempotente: se puede correr más de una vez en el SQL Editor de Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------

-- Reemplaza a is_broker_member()/is_broker_owner_or_admin() de segu.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- El repo la da por creada en supabase-setup.sql, pero puede no estar aplicada
-- en la base: se define acá para que esta migración no dependa de eso.
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$;

-- Cumpleaños: la fecha vive en el cliente, no hay tabla aparte.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;

-- ---------------------------------------------------------------------
-- 1. Auditoría transversal
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_events_resource ON public.audit_events(resource_type, resource_id, created_at DESC);
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins leen auditoría" ON public.audit_events;
CREATE POLICY "Admins leen auditoría" ON public.audit_events FOR SELECT USING (public.is_admin());

-- ---------------------------------------------------------------------
-- 2. SINIESTROS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  insurer_name TEXT,
  external_number TEXT,
  claim_type TEXT NOT NULL,
  occurrence_date DATE,
  reported_at TIMESTAMPTZ,
  description TEXT,
  estimated_amount NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','reported','in_review','submitted','awaiting_insurer','resolved','closed','reopened','archived')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  closed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_claims_client ON public.claims(client_id);
CREATE INDEX IF NOT EXISTS idx_claims_policy ON public.claims(policy_id);
CREATE INDEX IF NOT EXISTS idx_claims_assignee ON public.claims(assignee_id);

CREATE TABLE IF NOT EXISTS public.claim_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_claim_events_claim ON public.claim_events(claim_id, effective_at DESC);

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','blocked','done','cancelled')),
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_claim ON public.tasks(claim_id, status);

CREATE TABLE IF NOT EXISTS public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  storage_bucket TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  sha256 TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','portal_shared')),
  shared_at TIMESTAMPTZ, shared_by UUID,
  revoked_at TIMESTAMPTZ, revoked_by UUID, revoke_reason TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attachments_claim ON public.attachments(claim_id, created_at DESC);

-- Máquina de estados del siniestro. Idéntica a la de segu.
CREATE OR REPLACE FUNCTION public.assert_claim_transition(p_from TEXT, p_to TEXT, p_reason TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE normalized TEXT := NULLIF(regexp_replace(trim(COALESCE(p_reason, '')), '\s+', ' ', 'g'), ''); allowed BOOLEAN := FALSE;
BEGIN
  IF p_from = 'draft' AND p_to IN ('reported','archived') THEN allowed := TRUE;
  ELSIF p_from = 'reported' AND p_to IN ('in_review','archived') THEN allowed := TRUE;
  ELSIF p_from = 'in_review' AND p_to IN ('submitted','resolved','archived') THEN allowed := TRUE;
  ELSIF p_from = 'submitted' AND p_to IN ('awaiting_insurer','resolved','archived') THEN allowed := TRUE;
  ELSIF p_from = 'awaiting_insurer' AND p_to IN ('resolved','reopened','archived') THEN allowed := TRUE;
  ELSIF p_from = 'resolved' AND p_to IN ('closed','reopened','archived') THEN allowed := TRUE;
  ELSIF p_from = 'closed' AND p_to IN ('reopened','archived') THEN allowed := TRUE;
  ELSIF p_from = 'reopened' AND p_to IN ('in_review','resolved','archived') THEN allowed := TRUE;
  END IF;
  IF NOT allowed OR p_from = p_to THEN RAISE EXCEPTION 'transición de siniestro inválida' USING ERRCODE = '22023'; END IF;
  IF p_to IN ('resolved','closed','reopened','archived') AND normalized IS NULL THEN
    RAISE EXCEPTION 'motivo obligatorio para la transición' USING ERRCODE = '22023';
  END IF;
END; $$;

-- El cliente del siniestro siempre es el titular de la póliza.
CREATE OR REPLACE FUNCTION public.validate_claim_refs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_policy_client UUID;
BEGIN
  SELECT p.client_id INTO v_policy_client FROM public.policies p WHERE p.id = NEW.policy_id;
  IF v_policy_client IS NULL THEN RAISE EXCEPTION 'policy_id inexistente' USING ERRCODE = '23514'; END IF;
  IF NEW.client_id IS DISTINCT FROM v_policy_client THEN
    RAISE EXCEPTION 'el cliente del siniestro debe ser el titular de la póliza' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.enforce_claim_initial_state()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status <> 'draft' THEN RAISE EXCEPTION 'un siniestro sólo se crea en draft' USING ERRCODE = '22023'; END IF;
  RETURN NEW;
END; $$;

-- El payload del timeline es cerrado: nada de campos libres.
CREATE OR REPLACE FUNCTION public.validate_claim_event_contract()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE key TEXT;
BEGIN
  FOR key IN SELECT jsonb_object_keys(COALESCE(NEW.payload, '{}'::jsonb)) LOOP
    IF key NOT IN ('reason','note','from_status','to_status','metadata') THEN
      RAISE EXCEPTION 'campo de claim_event no permitido: %', key USING ERRCODE = '22023';
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_claims_refs ON public.claims;
CREATE TRIGGER trg_claims_refs BEFORE INSERT OR UPDATE OF policy_id, client_id ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.validate_claim_refs();
DROP TRIGGER IF EXISTS trg_claims_initial_state ON public.claims;
CREATE TRIGGER trg_claims_initial_state BEFORE INSERT ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.enforce_claim_initial_state();
DROP TRIGGER IF EXISTS trg_claims_updated_at ON public.claims;
CREATE TRIGGER trg_claims_updated_at BEFORE UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_claim_events_contract ON public.claim_events;
CREATE TRIGGER trg_claim_events_contract BEFORE INSERT ON public.claim_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_claim_event_contract();
DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Alta: el cliente se deriva de la póliza, nunca se acepta del request.
CREATE OR REPLACE FUNCTION public.create_claim(p_actor_id UUID, p_payload JSONB)
RETURNS public.claims LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result public.claims; v_policy_id UUID; v_client_id UUID;
BEGIN
  IF p_actor_id <> auth.uid() OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'operación no autorizada' USING ERRCODE = '42501';
  END IF;
  v_policy_id := NULLIF(p_payload->>'policy_id','')::uuid;
  IF v_policy_id IS NULL THEN RAISE EXCEPTION 'un siniestro necesita una póliza' USING ERRCODE = '22023'; END IF;
  SELECT p.client_id INTO v_client_id FROM public.policies p WHERE p.id = v_policy_id;
  IF v_client_id IS NULL THEN RAISE EXCEPTION 'la póliza no existe' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.claims (client_id, policy_id, assignee_id, insurer_name, external_number, claim_type,
    occurrence_date, reported_at, description, estimated_amount, status, priority, created_by)
  VALUES (v_client_id, v_policy_id, NULLIF(p_payload->>'assignee_id','')::uuid,
    NULLIF(p_payload->>'insurer_name',''), NULLIF(p_payload->>'external_number',''), p_payload->>'claim_type',
    NULLIF(p_payload->>'occurrence_date','')::date, NULLIF(p_payload->>'reported_at','')::timestamptz,
    NULLIF(p_payload->>'description',''), NULLIF(p_payload->>'estimated_amount','')::numeric,
    'draft', COALESCE(NULLIF(p_payload->>'priority',''),'normal'), p_actor_id)
  RETURNING * INTO result;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.transition_claim_atomic(p_claim_id UUID, p_actor_id UUID, p_updates JSONB, p_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE current_claim public.claims; next_status TEXT; normalized_reason TEXT;
BEGIN
  IF p_actor_id <> auth.uid() OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'operación no autorizada' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO current_claim FROM public.claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'siniestro no encontrado' USING ERRCODE = 'P0002'; END IF;
  next_status := COALESCE(p_updates->>'status', current_claim.status);
  normalized_reason := NULLIF(regexp_replace(trim(COALESCE(p_reason, p_updates->>'reason', '')), '\s+', ' ', 'g'), '');
  IF next_status IS DISTINCT FROM current_claim.status THEN
    PERFORM public.assert_claim_transition(current_claim.status, next_status, normalized_reason);
  END IF;
  UPDATE public.claims SET status = next_status,
    priority = COALESCE(p_updates->>'priority', priority),
    assignee_id = CASE WHEN p_updates ? 'assignee_id' THEN NULLIF(p_updates->>'assignee_id','')::uuid ELSE assignee_id END,
    description = CASE WHEN p_updates ? 'description' THEN p_updates->>'description' ELSE description END,
    insurer_name = CASE WHEN p_updates ? 'insurer_name' THEN p_updates->>'insurer_name' ELSE insurer_name END,
    external_number = CASE WHEN p_updates ? 'external_number' THEN p_updates->>'external_number' ELSE external_number END,
    occurrence_date = CASE WHEN p_updates ? 'occurrence_date' THEN NULLIF(p_updates->>'occurrence_date','')::date ELSE occurrence_date END,
    reported_at = CASE WHEN p_updates ? 'reported_at' THEN NULLIF(p_updates->>'reported_at','')::timestamptz ELSE reported_at END,
    estimated_amount = CASE WHEN p_updates ? 'estimated_amount' THEN NULLIF(p_updates->>'estimated_amount','')::numeric ELSE estimated_amount END,
    updated_at = now(),
    closed_at = CASE WHEN next_status = 'closed' THEN COALESCE(closed_at, now())
                     WHEN next_status = 'reopened' THEN NULL ELSE closed_at END
    WHERE id = p_claim_id;
  IF next_status IS DISTINCT FROM current_claim.status THEN
    INSERT INTO public.claim_events (claim_id, actor_id, type, from_status, to_status, payload)
    VALUES (p_claim_id, p_actor_id, 'status_changed', current_claim.status, next_status,
      jsonb_build_object('reason', normalized_reason, 'metadata', COALESCE(p_updates->'metadata','{}'::jsonb)));
  END IF;
  INSERT INTO public.audit_events (actor_id, action, resource_type, resource_id, metadata)
  VALUES (p_actor_id, 'claim.updated', 'claim', p_claim_id,
    jsonb_build_object('from_status', current_claim.status, 'to_status', next_status));
  RETURN jsonb_build_object('id', p_claim_id, 'status', next_status);
END; $$;

CREATE OR REPLACE FUNCTION public.append_claim_event_atomic(
  p_claim_id UUID, p_actor_id UUID, p_type TEXT, p_from_status TEXT DEFAULT NULL,
  p_to_status TEXT DEFAULT NULL, p_payload JSONB DEFAULT '{}'::jsonb,
  p_effective_at TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE current_claim public.claims; event_row public.claim_events;
BEGIN
  IF p_actor_id <> auth.uid() OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'operación no autorizada' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO current_claim FROM public.claims WHERE id = p_claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'siniestro no encontrado' USING ERRCODE = 'P0002'; END IF;
  IF p_type IN ('status_changed','archived') THEN
    IF p_from_status IS DISTINCT FROM current_claim.status OR p_to_status IS NULL THEN
      RAISE EXCEPTION 'estado origen obsoleto' USING ERRCODE = 'P0001';
    END IF;
    PERFORM public.assert_claim_transition(current_claim.status, p_to_status, p_payload->>'reason');
  END IF;
  IF p_to_status IS NOT NULL THEN
    UPDATE public.claims SET status = p_to_status, updated_at = now(),
      closed_at = CASE WHEN p_to_status = 'closed' THEN COALESCE(closed_at, now())
                       WHEN p_to_status = 'reopened' THEN NULL ELSE closed_at END
      WHERE id = p_claim_id;
  END IF;
  INSERT INTO public.claim_events (claim_id, actor_id, type, from_status, to_status, payload, effective_at)
  VALUES (p_claim_id, p_actor_id, p_type, current_claim.status, p_to_status,
    COALESCE(p_payload, '{}'::jsonb), COALESCE(p_effective_at, now()))
  RETURNING * INTO event_row;
  INSERT INTO public.audit_events (actor_id, action, resource_type, resource_id, metadata)
  VALUES (p_actor_id, 'claim.event_appended', 'claim', p_claim_id,
    jsonb_build_object('from_status', current_claim.status, 'to_status', p_to_status));
  RETURN jsonb_build_object('event', to_jsonb(event_row),
    'claim', (SELECT to_jsonb(c) FROM public.claims c WHERE c.id = p_claim_id));
END; $$;

-- Compartir/revocar un adjunto pasa sí o sí por la RPC.
CREATE OR REPLACE FUNCTION public.lock_attachment_transitions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND current_setting('app.attachment_transition', true) IS DISTINCT FROM '1' AND (
    NEW.visibility IS DISTINCT FROM OLD.visibility OR NEW.shared_at IS DISTINCT FROM OLD.shared_at OR
    NEW.shared_by IS DISTINCT FROM OLD.shared_by OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at OR
    NEW.revoked_by IS DISTINCT FROM OLD.revoked_by OR NEW.revoke_reason IS DISTINCT FROM OLD.revoke_reason OR
    NEW.archived_at IS DISTINCT FROM OLD.archived_at
  ) THEN
    RAISE EXCEPTION 'las transiciones de adjuntos deben usar una RPC' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_attachments_lock ON public.attachments;
CREATE TRIGGER trg_attachments_lock BEFORE UPDATE ON public.attachments
  FOR EACH ROW EXECUTE FUNCTION public.lock_attachment_transitions();

CREATE OR REPLACE FUNCTION public.transition_attachment(p_attachment_id UUID, p_actor_id UUID, p_action TEXT, p_reason TEXT DEFAULT NULL)
RETURNS public.attachments LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result public.attachments; normalized_reason TEXT;
BEGIN
  IF p_action NOT IN ('share','revoke','archive') THEN RAISE EXCEPTION 'acción de adjunto inválida' USING ERRCODE = '22023'; END IF;
  IF p_actor_id <> auth.uid() OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'operación no autorizada' USING ERRCODE = '42501';
  END IF;
  normalized_reason := NULLIF(regexp_replace(trim(COALESCE(p_reason, '')), '\s+', ' ', 'g'), '');
  IF p_action = 'revoke' AND normalized_reason IS NULL THEN RAISE EXCEPTION 'motivo obligatorio' USING ERRCODE = '22023'; END IF;
  PERFORM set_config('app.attachment_transition', '1', true);
  UPDATE public.attachments SET
    visibility = CASE WHEN p_action = 'share' THEN 'portal_shared' WHEN p_action = 'revoke' THEN 'internal' ELSE visibility END,
    shared_at = CASE WHEN p_action = 'share' THEN now() ELSE shared_at END,
    shared_by = CASE WHEN p_action = 'share' THEN p_actor_id ELSE shared_by END,
    revoked_at = CASE WHEN p_action = 'revoke' THEN now() ELSE revoked_at END,
    revoked_by = CASE WHEN p_action = 'revoke' THEN p_actor_id ELSE revoked_by END,
    revoke_reason = CASE WHEN p_action = 'revoke' THEN normalized_reason ELSE revoke_reason END,
    archived_at = CASE WHEN p_action = 'archive' THEN now() ELSE archived_at END
    WHERE id = p_attachment_id AND (p_action = 'archive' OR revoked_at IS NULL)
    RETURNING * INTO result;
  PERFORM set_config('app.attachment_transition', '0', true);
  IF NOT FOUND THEN RAISE EXCEPTION 'adjunto no encontrado o transición inválida' USING ERRCODE = 'P0002'; END IF;
  RETURN result;
END; $$;

-- ---------------------------------------------------------------------
-- 3. COBRANZA
-- ---------------------------------------------------------------------

-- El deudor es la persona; las cuotas cuelgan de él. Es la tarjeta del tablero.
CREATE TABLE IF NOT EXISTS public.collection_debtors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  document TEXT,
  status TEXT NOT NULL DEFAULT 'sin_gestionar'
    CHECK (status IN ('sin_gestionar','contactado','promesa','no_renovo','incobrable','al_dia')),
  assignee_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  next_action_at TIMESTAMPTZ,
  last_contact_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_collection_debtors_document
  ON public.collection_debtors(document) WHERE document IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_collection_debtors_status ON public.collection_debtors(status, next_action_at);

CREATE TABLE IF NOT EXISTS public.company_import_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  mapping JSONB NOT NULL,
  normalizers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, version)
);

CREATE TABLE IF NOT EXISTS public.collection_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  period_start DATE, period_end DATE,
  file_name TEXT NOT NULL DEFAULT 'import',
  storage_bucket TEXT, storage_path TEXT,
  source_sha256 TEXT NOT NULL,
  source_content_type TEXT,
  source_bytes BIGINT,
  original_storage_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  mapping_version_id UUID REFERENCES public.company_import_mappings(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded','preview','applied','partially_applied','failed')),
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_import_batches_source
  ON public.collection_import_batches(source_sha256, mapping_version_id);

CREATE TABLE IF NOT EXISTS public.collection_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.collection_import_batches(id) ON DELETE CASCADE,
  mapping_version_id UUID REFERENCES public.company_import_mappings(id) ON DELETE SET NULL,
  row_number INTEGER NOT NULL,
  raw_payload JSONB NOT NULL,
  normalized_payload JSONB,
  row_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','valid','warning','error','skipped','applied')),
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  dedupe_key TEXT,
  obligation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, row_number)
);

CREATE TABLE IF NOT EXISTS public.collection_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debtor_id UUID NOT NULL REFERENCES public.collection_debtors(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  policy_id UUID REFERENCES public.policies(id) ON DELETE SET NULL,
  policy_number_snapshot TEXT,
  external_reference TEXT,
  due_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'UYU' CHECK (currency IN ('UYU','USD')),
  balance NUMERIC(14,2) NOT NULL CHECK (balance >= 0),
  installment_number INTEGER,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','open','contacted','promise_to_pay','partially_paid','paid','disputed','not_renewed','archived')),
  source_batch_id UUID REFERENCES public.collection_import_batches(id) ON DELETE SET NULL,
  source_row_id UUID REFERENCES public.collection_import_rows(id) ON DELETE SET NULL,
  mapping_version_id UUID REFERENCES public.company_import_mappings(id) ON DELETE SET NULL,
  dedupe_key TEXT,
  raw_payload JSONB, normalized_payload JSONB,
  archived_at TIMESTAMPTZ, archived_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Idempotencia del importador: la misma fila del mismo perfil no duplica cuota.
CREATE UNIQUE INDEX IF NOT EXISTS uq_obligations_dedupe
  ON public.collection_obligations(mapping_version_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_obligations_debtor ON public.collection_obligations(debtor_id, due_date);
CREATE INDEX IF NOT EXISTS idx_obligations_status ON public.collection_obligations(status, due_date);

CREATE TABLE IF NOT EXISTS public.collection_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debtor_id UUID NOT NULL REFERENCES public.collection_debtors(id) ON DELETE CASCADE,
  obligation_id UUID REFERENCES public.collection_obligations(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  channel TEXT NOT NULL CHECK (channel IN ('telefono','email','presencial','otro')),
  outcome TEXT NOT NULL CHECK (outcome IN ('contactado','promesa','pagó','no_renovó','baja')),
  note TEXT,
  next_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contacts_debtor ON public.collection_contacts(debtor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.collection_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id UUID NOT NULL REFERENCES public.collection_obligations(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'UYU',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference TEXT, note TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_idempotency
  ON public.collection_payment_events(idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.collection_import_rows
  DROP CONSTRAINT IF EXISTS collection_import_rows_obligation_id_fkey;
ALTER TABLE public.collection_import_rows
  ADD CONSTRAINT collection_import_rows_obligation_id_fkey
  FOREIGN KEY (obligation_id) REFERENCES public.collection_obligations(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS trg_debtors_updated_at ON public.collection_debtors;
CREATE TRIGGER trg_debtors_updated_at BEFORE UPDATE ON public.collection_debtors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_obligations_updated_at ON public.collection_obligations;
CREATE TRIGGER trg_obligations_updated_at BEFORE UPDATE ON public.collection_obligations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_batches_updated_at ON public.collection_import_batches;
CREATE TRIGGER trg_batches_updated_at BEFORE UPDATE ON public.collection_import_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- El documento se guarda sin espacios: es la clave con la que se agrupa gente.
CREATE OR REPLACE FUNCTION public.normalize_debtor_document()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.document := NULLIF(regexp_replace(COALESCE(NEW.document, ''), '\s+', '', 'g'), '');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_debtors_normalize ON public.collection_debtors;
CREATE TRIGGER trg_debtors_normalize BEFORE INSERT OR UPDATE ON public.collection_debtors
  FOR EACH ROW EXECUTE FUNCTION public.normalize_debtor_document();

-- La cuota puntual de una gestión tiene que ser de ese mismo deudor.
CREATE OR REPLACE FUNCTION public.validate_contact_refs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.obligation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.collection_obligations o
    WHERE o.id = NEW.obligation_id AND o.debtor_id = NEW.debtor_id
  ) THEN RAISE EXCEPTION 'la cuota no pertenece a ese deudor' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_contacts_refs ON public.collection_contacts;
CREATE TRIGGER trg_contacts_refs BEFORE INSERT OR UPDATE ON public.collection_contacts
  FOR EACH ROW EXECUTE FUNCTION public.validate_contact_refs();

-- El tablero: una fila por persona con la deuda ya sumada por moneda.
CREATE OR REPLACE VIEW public.collection_debtor_summary
WITH (security_invoker = true) AS
SELECT d.id, d.client_id, d.display_name, d.document, d.status, d.assignee_id,
  d.next_action_at, d.last_contact_at, d.updated_at,
  COALESCE(o.cuotas, 0::bigint) AS cuotas,
  COALESCE(o.cuotas_vencidas, 0::bigint) AS cuotas_vencidas,
  COALESCE(o.polizas, 0::bigint) AS polizas,
  COALESCE(o.saldo_por_moneda, '{}'::jsonb) AS saldo_por_moneda,
  o.vencimiento_mas_antiguo
FROM public.collection_debtors d
LEFT JOIN LATERAL (
  SELECT count(*) AS cuotas,
    count(*) FILTER (WHERE co.due_date < CURRENT_DATE) AS cuotas_vencidas,
    count(DISTINCT co.policy_id) AS polizas,
    min(co.due_date) AS vencimiento_mas_antiguo,
    (SELECT jsonb_object_agg(m.currency, m.total) FROM (
        SELECT currency, sum(balance) AS total FROM public.collection_obligations
        WHERE debtor_id = d.id AND status NOT IN ('paid','archived')
        GROUP BY currency) m) AS saldo_por_moneda
  FROM public.collection_obligations co
  WHERE co.debtor_id = d.id AND co.status NOT IN ('paid','archived')
) o ON true;

CREATE OR REPLACE FUNCTION public.assert_collection_obligation_transition(p_from TEXT, p_to TEXT, p_reason TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE normalized TEXT := NULLIF(regexp_replace(trim(COALESCE(p_reason,'')), '\s+', ' ', 'g'), ''); allowed BOOLEAN := FALSE;
BEGIN
  IF p_from = 'new' AND p_to IN ('open','contacted','disputed','not_renewed','archived') THEN allowed := TRUE;
  ELSIF p_from = 'open' AND p_to IN ('contacted','promise_to_pay','partially_paid','disputed','not_renewed','archived') THEN allowed := TRUE;
  ELSIF p_from = 'contacted' AND p_to IN ('promise_to_pay','partially_paid','disputed','not_renewed','archived') THEN allowed := TRUE;
  ELSIF p_from = 'promise_to_pay' AND p_to IN ('partially_paid','paid','disputed','not_renewed','archived') THEN allowed := TRUE;
  ELSIF p_from = 'partially_paid' AND p_to IN ('paid','disputed','archived') THEN allowed := TRUE;
  ELSIF p_from = 'disputed' AND p_to IN ('open','archived') THEN allowed := TRUE;
  ELSIF p_from = 'not_renewed' AND p_to = 'archived' THEN allowed := TRUE;
  END IF;
  IF NOT allowed OR p_from = p_to THEN RAISE EXCEPTION 'transición de obligación inválida' USING ERRCODE = '22023'; END IF;
  IF p_to IN ('paid','not_renewed','archived') AND normalized IS NULL THEN
    RAISE EXCEPTION 'motivo obligatorio para la transición' USING ERRCODE = '22023';
  END IF;
END; $$;

-- Devuelve el deudor al que pertenece una cuota, creándolo si hace falta.
CREATE OR REPLACE FUNCTION public.resolve_collection_debtor(p_document TEXT, p_display_name TEXT, p_client_id UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_doc TEXT; v_id UUID; v_name TEXT;
BEGIN
  v_doc := NULLIF(regexp_replace(COALESCE(p_document, ''), '\s+', '', 'g'), '');
  v_name := NULLIF(regexp_replace(trim(COALESCE(p_display_name, '')), '\s+', ' ', 'g'), '');

  -- Si hay cliente, su nombre gana: la referencia externa o el nombre del
  -- archivo son peores identificadores que la ficha real.
  IF p_client_id IS NOT NULL THEN
    SELECT c.documento, COALESCE(c.nombre, v_name) INTO v_doc, v_name
      FROM public.clients c WHERE c.id = p_client_id;
    v_doc := NULLIF(regexp_replace(COALESCE(v_doc, ''), '\s+', '', 'g'), '');
  END IF;

  IF v_doc IS NOT NULL THEN
    SELECT id INTO v_id FROM public.collection_debtors WHERE document = v_doc;
    IF v_id IS NOT NULL THEN
      -- Un deudor importado sin match puede ganar su cliente más adelante.
      UPDATE public.collection_debtors
        SET client_id = COALESCE(client_id, p_client_id),
            display_name = COALESCE(
              NULLIF(NULLIF(display_name, ''), 'Deudor sin identificar'),
              v_name, display_name)
        WHERE id = v_id;
      RETURN v_id;
    END IF;
  ELSIF p_client_id IS NOT NULL THEN
    SELECT id INTO v_id FROM public.collection_debtors WHERE client_id = p_client_id LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  INSERT INTO public.collection_debtors (client_id, display_name, document)
  VALUES (p_client_id, COALESCE(v_name, 'Deudor sin identificar'), v_doc)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.create_collection_obligation(p_actor_id UUID, p_payload JSONB)
RETURNS public.collection_obligations LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result public.collection_obligations; v_client UUID; v_debtor UUID; v_name TEXT; v_doc TEXT;
BEGIN
  IF p_actor_id <> auth.uid() OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'operación no autorizada' USING ERRCODE = '42501';
  END IF;
  v_client := NULLIF(p_payload->>'client_id','')::uuid;
  -- Sin cliente, la referencia externa nombra al deudor hasta que se lo vincule;
  -- resolve_collection_debtor pone el placeholder si tampoco hay referencia.
  v_name := NULLIF(p_payload->>'external_reference','');
  v_doc := NULLIF(p_payload->>'debtor_document','');
  v_debtor := public.resolve_collection_debtor(v_doc, v_name, v_client);

  INSERT INTO public.collection_obligations (debtor_id, company_id, client_id, policy_id, external_reference,
    due_date, amount, currency, installment_number, status, balance)
  VALUES (v_debtor, (p_payload->>'company_id')::uuid, v_client,
    NULLIF(p_payload->>'policy_id','')::uuid, NULLIF(p_payload->>'external_reference',''),
    (p_payload->>'due_date')::date, (p_payload->>'amount')::numeric,
    upper(COALESCE(NULLIF(p_payload->>'currency',''),'UYU'))::char(3),
    NULLIF(p_payload->>'installment_number','')::integer,
    COALESCE(NULLIF(p_payload->>'status',''),'new'), (p_payload->>'amount')::numeric)
  RETURNING * INTO result;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.transition_collection_obligation(
  p_obligation_id UUID, p_actor_id UUID, p_status TEXT, p_reason TEXT, p_updates JSONB DEFAULT '{}'::jsonb)
RETURNS public.collection_obligations LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE current public.collection_obligations; result public.collection_obligations;
  normalized TEXT := NULLIF(regexp_replace(trim(COALESCE(p_reason,'')), '\s+', ' ', 'g'), '');
BEGIN
  IF p_actor_id <> auth.uid() OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'operación no autorizada' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO current FROM public.collection_obligations WHERE id = p_obligation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'obligación no encontrada' USING ERRCODE = 'P0002'; END IF;
  IF current.status = p_status AND p_updates = '{}'::jsonb THEN
    RAISE EXCEPTION 'la obligación ya se encuentra en ese estado' USING ERRCODE = '23505';
  END IF;
  IF current.status IS DISTINCT FROM p_status THEN
    PERFORM public.assert_collection_obligation_transition(current.status, p_status, normalized);
  END IF;
  UPDATE public.collection_obligations SET status = p_status,
    due_date = CASE WHEN p_updates ? 'due_date' THEN (p_updates->>'due_date')::date ELSE due_date END,
    external_reference = CASE WHEN p_updates ? 'external_reference' THEN p_updates->>'external_reference' ELSE external_reference END,
    updated_at = now(),
    archived_at = CASE WHEN p_status = 'archived' THEN now() ELSE archived_at END,
    archived_by = CASE WHEN p_status = 'archived' THEN p_actor_id ELSE archived_by END
    WHERE id = p_obligation_id RETURNING * INTO result;
  INSERT INTO public.audit_events (actor_id, action, resource_type, resource_id, metadata)
  VALUES (p_actor_id,
    CASE WHEN current.status IS DISTINCT FROM p_status THEN 'collection.status_changed' ELSE 'collection.updated' END,
    'collection_obligation', p_obligation_id,
    jsonb_build_object('from_status', current.status, 'to_status', p_status, 'reason', normalized));
  RETURN result;
END; $$;

-- Mover la tarjeta de columna deja siempre rastro como gestión.
CREATE OR REPLACE FUNCTION public.transition_debtor_status(
  p_debtor_id UUID, p_actor_id UUID, p_status TEXT, p_note TEXT DEFAULT NULL, p_next_action_at TIMESTAMPTZ DEFAULT NULL)
RETURNS public.collection_debtors LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result public.collection_debtors; current_status TEXT; normalized TEXT; v_client UUID;
BEGIN
  IF p_actor_id <> auth.uid() OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'operación no autorizada' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('sin_gestionar','contactado','promesa','no_renovo','incobrable','al_dia') THEN
    RAISE EXCEPTION 'estado de gestión inválido' USING ERRCODE = '22023';
  END IF;
  SELECT status, client_id INTO current_status, v_client FROM public.collection_debtors
    WHERE id = p_debtor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'deudor no encontrado' USING ERRCODE = 'P0002'; END IF;

  normalized := NULLIF(regexp_replace(trim(COALESCE(p_note,'')), '\s+', ' ', 'g'), '');
  IF p_status IN ('no_renovo','incobrable') AND normalized IS NULL THEN
    RAISE EXCEPTION 'dar por no renovado o incobrable exige una nota' USING ERRCODE = '22023';
  END IF;

  UPDATE public.collection_debtors
    SET status = p_status,
        next_action_at = COALESCE(p_next_action_at, next_action_at),
        last_contact_at = now()
    WHERE id = p_debtor_id RETURNING * INTO result;

  INSERT INTO public.collection_contacts (debtor_id, client_id, actor_id, channel, outcome, note, next_action_at)
  VALUES (p_debtor_id, v_client, p_actor_id, 'otro',
    CASE p_status WHEN 'promesa' THEN 'promesa' WHEN 'no_renovo' THEN 'no_renovó'
                  WHEN 'incobrable' THEN 'baja' WHEN 'al_dia' THEN 'pagó' ELSE 'contactado' END,
    normalized, p_next_action_at);

  INSERT INTO public.audit_events (actor_id, action, resource_type, resource_id, metadata)
  VALUES (p_actor_id, 'debtor.status_changed', 'collection_debtor', p_debtor_id,
    jsonb_build_object('from_status', current_status, 'to_status', p_status, 'note', normalized));
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.record_collection_contact(
  p_debtor_id UUID, p_actor_id UUID, p_channel TEXT, p_outcome TEXT,
  p_note TEXT, p_next_action_at TIMESTAMPTZ, p_obligation_id UUID DEFAULT NULL)
RETURNS public.collection_contacts LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result public.collection_contacts; v_client UUID; next_status TEXT;
BEGIN
  IF p_actor_id <> auth.uid() OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'gestión inválida o perfil no autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_outcome NOT IN ('contactado','promesa','pagó','no_renovó','baja') THEN
    RAISE EXCEPTION 'resultado de gestión inválido' USING ERRCODE = '22023';
  END IF;
  SELECT client_id INTO v_client FROM public.collection_debtors WHERE id = p_debtor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'deudor no encontrado' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO public.collection_contacts (debtor_id, obligation_id, client_id, actor_id, channel, outcome, note, next_action_at)
  VALUES (p_debtor_id, p_obligation_id, v_client, p_actor_id, p_channel, p_outcome,
    NULLIF(trim(p_note), ''), p_next_action_at)
  RETURNING * INTO result;

  next_status := CASE p_outcome WHEN 'promesa' THEN 'promesa' WHEN 'no_renovó' THEN 'no_renovo'
                                WHEN 'baja' THEN 'incobrable' WHEN 'pagó' THEN 'al_dia' ELSE 'contactado' END;
  UPDATE public.collection_debtors
    SET status = next_status, last_contact_at = now(),
        next_action_at = COALESCE(p_next_action_at, next_action_at)
    WHERE id = p_debtor_id;
  RETURN result;
END; $$;

-- Idempotente por clave: un doble clic no cobra dos veces.
CREATE OR REPLACE FUNCTION public.record_collection_payment(
  p_obligation_id UUID, p_actor_id UUID, p_amount NUMERIC, p_currency CHAR,
  p_paid_at TIMESTAMPTZ, p_reference TEXT, p_note TEXT, p_idempotency_key TEXT)
RETURNS public.collection_payment_events LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result public.collection_payment_events; current_balance NUMERIC; obligation_currency CHAR(3); v_debtor UUID;
BEGIN
  IF p_actor_id <> auth.uid() OR NOT public.is_admin() OR NULLIF(trim(p_idempotency_key), '') IS NULL THEN
    RAISE EXCEPTION 'pago inválido o perfil no autorizado' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO result FROM public.collection_payment_events WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN result; END IF;
  SELECT balance, currency, debtor_id INTO current_balance, obligation_currency, v_debtor
    FROM public.collection_obligations WHERE id = p_obligation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'obligación no encontrada' USING ERRCODE = 'P0002'; END IF;
  IF p_currency IS DISTINCT FROM obligation_currency OR p_amount IS NULL OR p_amount <= 0 OR p_amount > current_balance THEN
    RAISE EXCEPTION 'pago inválido' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.collection_payment_events (obligation_id, actor_id, amount, currency, paid_at, reference, note, idempotency_key)
  VALUES (p_obligation_id, p_actor_id, p_amount, p_currency, COALESCE(p_paid_at, now()),
    NULLIF(trim(p_reference), ''), NULLIF(trim(p_note), ''), p_idempotency_key)
  RETURNING * INTO result;
  UPDATE public.collection_obligations SET balance = balance - p_amount,
    status = CASE WHEN balance - p_amount = 0 THEN 'paid' ELSE 'partially_paid' END, updated_at = now()
    WHERE id = p_obligation_id;
  -- Si la persona quedó sin saldo, la tarjeta se va sola a "Al día".
  IF NOT EXISTS (SELECT 1 FROM public.collection_obligations
                 WHERE debtor_id = v_debtor AND status NOT IN ('paid','archived') AND balance > 0) THEN
    UPDATE public.collection_debtors SET status = 'al_dia', last_contact_at = now()
      WHERE id = v_debtor AND status <> 'al_dia';
  END IF;
  RETURN result;
END; $$;

-- Los perfiles de mapeo son inmutables: el lote guarda con qué versión se leyó.
CREATE OR REPLACE FUNCTION public.prevent_import_mapping_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  RAISE EXCEPTION 'los perfiles de mapping son inmutables' USING ERRCODE = '55000';
END; $$;
DROP TRIGGER IF EXISTS trg_mappings_immutable ON public.company_import_mappings;
CREATE TRIGGER trg_mappings_immutable BEFORE UPDATE OR DELETE ON public.company_import_mappings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_import_mapping_mutation();

CREATE OR REPLACE FUNCTION public.create_company_import_mapping(
  p_company_id UUID, p_actor_id UUID, p_mapping JSONB, p_normalizers JSONB DEFAULT '{}'::jsonb)
RETURNS public.company_import_mappings LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result public.company_import_mappings; next_version INTEGER;
BEGIN
  IF p_actor_id <> auth.uid() OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'perfil no autorizado' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_company_id::text, 0));
  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version FROM public.company_import_mappings
    WHERE company_id = p_company_id;
  INSERT INTO public.company_import_mappings (company_id, version, mapping, normalizers, created_by)
  VALUES (p_company_id, next_version, p_mapping, COALESCE(p_normalizers, '{}'::jsonb), p_actor_id)
  RETURNING * INTO result;
  RETURN result;
END; $$;

-- Aplicar el lote: cada fila se resuelve contra clientes/pólizas existentes y
-- se agrupa por documento en un deudor. Una fila que falla no tumba el lote.
CREATE OR REPLACE FUNCTION public.apply_collection_import_batch(p_batch_id UUID, p_actor_id UUID, p_row_ids UUID[])
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE batch_row RECORD; source_row RECORD; v_obligation_id UUID; applied_count INTEGER := 0; error_count INTEGER := 0;
  row_errors JSONB := '[]'::jsonb; payload JSONB; company_uuid UUID; v_client_id UUID; v_policy_id UUID; v_debtor_id UUID;
BEGIN
  IF p_actor_id <> auth.uid() OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'operación no autorizada' USING ERRCODE = '42501';
  END IF;
  IF p_row_ids IS NULL OR cardinality(p_row_ids) = 0 THEN
    RAISE EXCEPTION 'debe seleccionar al menos una fila' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_batch_id::text, 0));
  SELECT * INTO batch_row FROM public.collection_import_batches WHERE id = p_batch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lote no encontrado' USING ERRCODE = 'P0002'; END IF;

  FOR source_row IN SELECT * FROM public.collection_import_rows
    WHERE batch_id = p_batch_id AND status IN ('valid','warning') AND id = ANY(p_row_ids)
    ORDER BY row_number FOR UPDATE LOOP
    payload := COALESCE(source_row.normalized_payload, source_row.raw_payload);
    BEGIN
      company_uuid := COALESCE(batch_row.company_id, NULLIF(payload->>'company_id', '')::uuid);
      IF company_uuid IS NULL THEN RAISE EXCEPTION 'company_id requerido'; END IF;

      v_client_id := NULL; v_policy_id := NULL;
      IF NULLIF(payload->>'debtor_document', '') IS NOT NULL THEN
        SELECT c.id INTO v_client_id FROM public.clients c
          WHERE c.documento = payload->>'debtor_document' ORDER BY c.created_at LIMIT 1;
      END IF;
      IF NULLIF(payload->>'policy_number', '') IS NOT NULL THEN
        SELECT p.id, COALESCE(v_client_id, p.client_id) INTO v_policy_id, v_client_id
          FROM public.policies p WHERE p.numero_poliza = payload->>'policy_number' LIMIT 1;
      END IF;

      -- El documento del archivo agrupa las cuotas de la misma persona aunque
      -- todavía no exista como cliente.
      v_debtor_id := public.resolve_collection_debtor(
        payload->>'debtor_document',
        COALESCE(NULLIF(payload->>'debtor_name',''), NULLIF(payload->>'external_reference','')),
        v_client_id);

      INSERT INTO public.collection_obligations (debtor_id, company_id, client_id, policy_id, policy_number_snapshot,
        mapping_version_id, external_reference, due_date, amount, currency, balance, installment_number,
        source_batch_id, source_row_id, dedupe_key, raw_payload, normalized_payload)
      VALUES (v_debtor_id, company_uuid, v_client_id, v_policy_id, NULLIF(payload->>'policy_number',''),
        batch_row.mapping_version_id, NULLIF(payload->>'external_reference',''), (payload->>'due_date')::date,
        (payload->>'amount')::numeric, upper(COALESCE(NULLIF(payload->>'currency',''),'UYU'))::char(3),
        (payload->>'amount')::numeric, NULLIF(payload->>'installment_number','')::integer,
        p_batch_id, source_row.id, source_row.dedupe_key, source_row.raw_payload, source_row.normalized_payload)
      ON CONFLICT (mapping_version_id, dedupe_key) WHERE dedupe_key IS NOT NULL
      DO UPDATE SET amount = EXCLUDED.amount, balance = EXCLUDED.balance,
        client_id = COALESCE(EXCLUDED.client_id, collection_obligations.client_id),
        policy_id = COALESCE(EXCLUDED.policy_id, collection_obligations.policy_id), updated_at = now()
      RETURNING id INTO v_obligation_id;

      UPDATE public.collection_import_rows SET status = 'applied', obligation_id = v_obligation_id, errors = '[]'::jsonb
        WHERE id = source_row.id;
      applied_count := applied_count + 1;
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      UPDATE public.collection_import_rows SET status = 'error',
        errors = jsonb_build_array(jsonb_build_object('message', SQLERRM)) WHERE id = source_row.id;
      row_errors := row_errors || jsonb_build_array(jsonb_build_object('row_number', source_row.row_number, 'message', SQLERRM));
    END;
  END LOOP;

  UPDATE public.collection_import_batches
    SET status = CASE WHEN error_count > 0 THEN 'partially_applied' ELSE 'applied' END, updated_at = now()
    WHERE id = p_batch_id;
  RETURN jsonb_build_object('batch_id', p_batch_id, 'applied', applied_count, 'errors', error_count, 'row_errors', row_errors);
END; $$;

-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
-- Todos estos módulos son de back office: sólo el admin lee y escribe. La
-- única excepción es el adjunto que el admin comparte explícitamente con su
-- cliente, que el titular puede ver desde el portal.

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['claims','claim_events','tasks','attachments','collection_debtors',
    'collection_obligations','collection_contacts','collection_payment_events',
    'collection_import_batches','collection_import_rows','company_import_mappings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins gestionan %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Admins gestionan %1$s" ON public.%1$I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Clientes ven adjuntos compartidos" ON public.attachments;
CREATE POLICY "Clientes ven adjuntos compartidos" ON public.attachments
  FOR SELECT USING (
    visibility = 'portal_shared' AND revoked_at IS NULL AND archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.claims c
      JOIN public.user_profiles up ON up.client_id = c.client_id
      WHERE c.id = attachments.claim_id AND up.id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 5. Storage
-- ---------------------------------------------------------------------
-- Se reusa el bucket que ya existe para pólizas: los adjuntos de siniestro
-- viven en claims/… y los originales de importación en imports/….

DROP POLICY IF EXISTS "Admins gestionan archivos de operaciones" ON storage.objects;
CREATE POLICY "Admins gestionan archivos de operaciones" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'policy-documents'
    AND (storage.foldername(name))[1] IN ('claims','imports')
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'policy-documents'
    AND (storage.foldername(name))[1] IN ('claims','imports')
    AND public.is_admin()
  );
