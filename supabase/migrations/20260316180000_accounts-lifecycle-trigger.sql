-- 1) Add columns to accounts that active_clients has but accounts doesn't
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS imported_by UUID REFERENCES auth.users(id);

-- Add FK from account_owner_id → profiles so PostgREST can resolve the join
-- (the existing FK points to auth.users; we add another to profiles for the API)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_account_owner_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_account_owner_id_profiles_fkey
      FOREIGN KEY (account_owner_id) REFERENCES public.profiles(id);
  END IF;
END $$;

-- 2) Trigger: auto-update accounts.lifecycle_stage when opportunity stage changes
CREATE OR REPLACE FUNCTION public.auto_update_account_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _account_id uuid;
  _has_won boolean;
  _has_active boolean;
BEGIN
  -- Resolve account_id from the opportunity (prefer direct, fallback via lead)
  _account_id := COALESCE(NEW.account_id, (SELECT account_id FROM leads WHERE id = NEW.lead_id));

  IF _account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if account has any won opportunity
  SELECT EXISTS(
    SELECT 1 FROM opportunities
    WHERE account_id = _account_id AND stage = 'Ganho'
      AND id IS DISTINCT FROM OLD.id  -- exclude the row being updated (use NEW values)
  ) INTO _has_won;

  -- Include the current row's new state
  IF NEW.stage = 'Ganho' THEN
    _has_won := true;
  END IF;

  IF _has_won THEN
    UPDATE accounts SET lifecycle_stage = 'client', updated_at = now()
    WHERE id = _account_id AND lifecycle_stage IS DISTINCT FROM 'client';
  ELSE
    -- Check if any non-terminal opportunity exists
    SELECT EXISTS(
      SELECT 1 FROM opportunities
      WHERE account_id = _account_id
        AND stage NOT IN ('Perdido', 'Ganho')
        AND id IS DISTINCT FROM OLD.id
    ) INTO _has_active;

    IF NEW.stage NOT IN ('Perdido', 'Ganho') THEN
      _has_active := true;
    END IF;

    IF _has_active THEN
      UPDATE accounts SET lifecycle_stage = 'opportunity', updated_at = now()
      WHERE id = _account_id AND lifecycle_stage IS DISTINCT FROM 'opportunity';
    ELSE
      UPDATE accounts SET lifecycle_stage = 'lead', updated_at = now()
      WHERE id = _account_id AND lifecycle_stage IS DISTINCT FROM 'lead';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_update_account_lifecycle ON opportunities;
CREATE TRIGGER trg_auto_update_account_lifecycle
  AFTER INSERT OR UPDATE OF stage ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_account_lifecycle();

-- 3) Backfill: sync active_clients data into accounts
-- For each active_client with valid CNPJ, ensure account exists and is 'client'
DO $$
DECLARE
  r RECORD;
  _account_id uuid;
  _clean_cnpj text;
BEGIN
  FOR r IN
    SELECT * FROM active_clients WHERE cnpj IS NOT NULL AND cnpj != ''
  LOOP
    _clean_cnpj := regexp_replace(r.cnpj, '\D', '', 'g');
    IF length(_clean_cnpj) != 14 THEN CONTINUE; END IF;

    -- Find existing account by CNPJ
    SELECT id INTO _account_id FROM accounts
    WHERE regexp_replace(COALESCE(cnpj, ''), '\D', '', 'g') = _clean_cnpj
    LIMIT 1;

    IF _account_id IS NOT NULL THEN
      -- Update lifecycle to client and fill any missing data
      UPDATE accounts SET
        lifecycle_stage = 'client',
        status = COALESCE(r.status, status, 'active'),
        contact_name = COALESCE(contact_name, r.contact_name),
        email = COALESCE(email, r.email),
        phone = COALESCE(phone, r.phone),
        enriched_at = COALESCE(enriched_at, r.enriched_at),
        imported_by = COALESCE(imported_by, r.imported_by),
        account_owner_id = COALESCE(account_owner_id, r.account_owner_id),
        updated_at = now()
      WHERE id = _account_id;
    ELSE
      -- Create account from active_client
      INSERT INTO accounts (
        company_name, cnpj, razao_social, nome_fantasia, company_segment,
        employee_count, revenue_range, porte, capital_social,
        cnae_fiscal, cnae_fiscal_descricao, cnaes_secundarios,
        situacao_cadastral, data_inicio_atividade, website,
        city, state, cep, email, phone, contact_name,
        lifecycle_stage, status, enriched_at, imported_by, account_owner_id,
        notes
      ) VALUES (
        r.company, r.cnpj, r.razao_social, r.nome_fantasia, r.segment,
        r.employee_count, r.revenue_range, r.porte, r.capital_social,
        r.cnae_fiscal, r.cnae_fiscal_descricao, r.cnaes_secundarios,
        r.situacao_cadastral, r.data_inicio_atividade, r.website,
        r.city, r.state, r.cep, r.email, r.phone, r.contact_name,
        'client', COALESCE(r.status, 'active'), r.enriched_at, r.imported_by,
        r.account_owner_id, r.notes
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- 4) Also backfill lifecycle from existing won opportunities (for accounts that
--    were created from leads but not from active_clients)
UPDATE accounts a SET lifecycle_stage = 'client', updated_at = now()
WHERE lifecycle_stage != 'client'
  AND EXISTS (
    SELECT 1 FROM opportunities o
    WHERE o.account_id = a.id AND o.stage = 'Ganho'
  );

-- 5) Drop the old trigger that copies to active_clients (no longer needed)
DROP TRIGGER IF EXISTS trg_auto_insert_active_client_on_won ON opportunities;
DROP FUNCTION IF EXISTS public.auto_insert_active_client_on_won();
