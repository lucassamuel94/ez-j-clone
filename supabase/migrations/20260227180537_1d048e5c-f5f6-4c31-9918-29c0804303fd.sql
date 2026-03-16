
-- Migrate existing leads without account_id:
-- For each lead without an account_id, create or link an account

-- Step 1: For leads WITH a CNPJ that matches an existing account, link them
UPDATE leads l
SET account_id = a.id
FROM accounts a
WHERE l.account_id IS NULL
  AND l.cnpj IS NOT NULL
  AND length(regexp_replace(l.cnpj, '\D', '', 'g')) = 14
  AND regexp_replace(COALESCE(a.cnpj, ''), '\D', '', 'g') = regexp_replace(l.cnpj, '\D', '', 'g');

-- Step 2: For remaining leads without account_id, create accounts and link
-- We use a DO block to iterate
DO $$
DECLARE
  r RECORD;
  _account_id uuid;
  _clean_cnpj text;
BEGIN
  FOR r IN
    SELECT * FROM leads WHERE account_id IS NULL ORDER BY created_at
  LOOP
    _clean_cnpj := regexp_replace(COALESCE(r.cnpj, ''), '\D', '', 'g');
    _account_id := NULL;

    -- Try to find existing account by CNPJ
    IF length(_clean_cnpj) = 14 THEN
      SELECT id INTO _account_id FROM accounts
      WHERE regexp_replace(COALESCE(cnpj, ''), '\D', '', 'g') = _clean_cnpj
      LIMIT 1;
    END IF;

    -- Create account if not found
    IF _account_id IS NULL THEN
      INSERT INTO accounts (
        company_name, cnpj, razao_social, nome_fantasia,
        company_segment, employee_count, revenue_range, porte,
        capital_social, cnae_fiscal, cnae_fiscal_descricao, cnaes_secundarios,
        situacao_cadastral, data_inicio_atividade, qsa, website,
        cep, logradouro, numero, complemento, bairro, city, state, country,
        email, phone, contact_name, lifecycle_stage
      ) VALUES (
        COALESCE(r.razao_social, r.nome_fantasia, r.company),
        CASE WHEN length(_clean_cnpj) = 14 THEN _clean_cnpj ELSE NULL END,
        r.razao_social, r.nome_fantasia,
        r.company_segment, r.employee_count, r.revenue_range, r.porte,
        r.capital_social, r.cnae_fiscal, r.cnae_fiscal_descricao, r.cnaes_secundarios,
        r.situacao_cadastral, r.data_inicio_atividade, r.qsa, r.website,
        r.cep, r.logradouro, r.numero, r.complemento, r.bairro, r.city, r.state, r.country,
        r.email, r.phone, r.name, 'lead'
      )
      RETURNING id INTO _account_id;
    END IF;

    -- Link lead to account
    UPDATE leads SET account_id = _account_id WHERE id = r.id;
  END LOOP;
END;
$$;

-- Step 3: Backfill account_id on opportunities from their lead
UPDATE opportunities o
SET account_id = l.account_id
FROM leads l
WHERE o.lead_id = l.id
  AND o.account_id IS NULL
  AND l.account_id IS NOT NULL;

-- Step 4: Update lifecycle_stage for accounts that have opportunities
UPDATE accounts a
SET lifecycle_stage = 'opportunity'
WHERE lifecycle_stage = 'lead'
  AND EXISTS (
    SELECT 1 FROM opportunities o
    WHERE o.account_id = a.id AND o.stage NOT IN ('Perdido')
  );

-- Step 5: Update lifecycle_stage for accounts with won opportunities
UPDATE accounts a
SET lifecycle_stage = 'client'
WHERE lifecycle_stage IN ('lead', 'opportunity')
  AND EXISTS (
    SELECT 1 FROM opportunities o
    WHERE o.account_id = a.id AND o.stage = 'Ganho'
  );
