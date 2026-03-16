
-- ============================================================
-- Tighten RLS policies now that account_id columns exist
-- ============================================================

-- Drop permissive policies
DROP POLICY IF EXISTS "Authenticated users can view accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can update accounts" ON public.accounts;

-- SELECT: managers see all; others see linked accounts
CREATE POLICY "Managers view all accounts"
  ON public.accounts FOR SELECT
  USING (
    public.is_manager(auth.uid()) OR public.is_admin(auth.uid())
    OR account_owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.leads WHERE leads.account_id = accounts.id AND leads.owner_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.opportunities WHERE opportunities.account_id = accounts.id AND opportunities.assigned_to_user_id = auth.uid())
  );

-- UPDATE: managers + linked users
CREATE POLICY "Linked users can update accounts"
  ON public.accounts FOR UPDATE
  USING (
    public.is_manager(auth.uid()) OR public.is_admin(auth.uid())
    OR account_owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.leads WHERE leads.account_id = accounts.id AND leads.owner_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.opportunities WHERE opportunities.account_id = accounts.id AND opportunities.assigned_to_user_id = auth.uid())
  );

-- ============================================================
-- Populate accounts from existing leads (grouped by CNPJ)
-- ============================================================

-- Step 1: Create accounts from leads WITH valid CNPJ (use most recent lead per CNPJ)
INSERT INTO public.accounts (cnpj, company_name, razao_social, nome_fantasia, company_segment, employee_count,
  revenue_range, porte, capital_social, cnae_fiscal, cnae_fiscal_descricao, cnaes_secundarios,
  situacao_cadastral, data_inicio_atividade, qsa, website, cep, logradouro, numero, complemento,
  bairro, city, state, country, ai_enrichment_data, lifecycle_stage, email, phone, contact_name)
SELECT DISTINCT ON (regexp_replace(l.cnpj, '[^0-9]', '', 'g'))
  l.cnpj, l.company, l.razao_social, l.nome_fantasia, l.company_segment, l.employee_count,
  l.revenue_range, l.porte, l.capital_social, l.cnae_fiscal, l.cnae_fiscal_descricao, l.cnaes_secundarios,
  l.situacao_cadastral, l.data_inicio_atividade, l.qsa, l.website, l.cep, l.logradouro, l.numero, l.complemento,
  l.bairro, l.city, l.state, l.country, l.ai_enrichment_data,
  CASE
    WHEN EXISTS (SELECT 1 FROM public.opportunities o WHERE o.lead_id = l.id AND o.stage = 'Ganho') THEN 'client'
    WHEN EXISTS (SELECT 1 FROM public.opportunities o WHERE o.lead_id = l.id AND o.stage NOT IN ('Ganho', 'Perdido')) THEN 'opportunity'
    ELSE 'lead'
  END,
  l.email, l.phone, l.name
FROM public.leads l
WHERE l.cnpj IS NOT NULL AND length(regexp_replace(l.cnpj, '[^0-9]', '', 'g')) = 14
ORDER BY regexp_replace(l.cnpj, '[^0-9]', '', 'g'), l.updated_at DESC;

-- Step 2: Create accounts for leads WITHOUT valid CNPJ (one account per lead)
INSERT INTO public.accounts (company_name, razao_social, nome_fantasia, company_segment, employee_count,
  revenue_range, porte, capital_social, cnae_fiscal, cnae_fiscal_descricao, cnaes_secundarios,
  situacao_cadastral, data_inicio_atividade, qsa, website, cep, logradouro, numero, complemento,
  bairro, city, state, country, ai_enrichment_data, lifecycle_stage, email, phone, contact_name)
SELECT
  l.company, l.razao_social, l.nome_fantasia, l.company_segment, l.employee_count,
  l.revenue_range, l.porte, l.capital_social, l.cnae_fiscal, l.cnae_fiscal_descricao, l.cnaes_secundarios,
  l.situacao_cadastral, l.data_inicio_atividade, l.qsa, l.website, l.cep, l.logradouro, l.numero, l.complemento,
  l.bairro, l.city, l.state, l.country, l.ai_enrichment_data,
  CASE
    WHEN EXISTS (SELECT 1 FROM public.opportunities o WHERE o.lead_id = l.id AND o.stage = 'Ganho') THEN 'client'
    WHEN EXISTS (SELECT 1 FROM public.opportunities o WHERE o.lead_id = l.id AND o.stage NOT IN ('Ganho', 'Perdido')) THEN 'opportunity'
    ELSE 'lead'
  END,
  l.email, l.phone, l.name
FROM public.leads l
WHERE l.cnpj IS NULL OR length(regexp_replace(l.cnpj, '[^0-9]', '', 'g')) < 14;

-- Step 3: Link leads to accounts (by CNPJ for those with valid CNPJ)
UPDATE public.leads l
SET account_id = a.id
FROM public.accounts a
WHERE l.cnpj IS NOT NULL
  AND length(regexp_replace(l.cnpj, '[^0-9]', '', 'g')) = 14
  AND regexp_replace(l.cnpj, '[^0-9]', '', 'g') = regexp_replace(a.cnpj, '[^0-9]', '', 'g');

-- Step 4: Link leads without CNPJ (match by company_name + email + phone)
UPDATE public.leads l
SET account_id = a.id
FROM public.accounts a
WHERE l.account_id IS NULL
  AND a.cnpj IS NULL
  AND a.company_name = l.company
  AND COALESCE(a.email, '') = COALESCE(l.email, '')
  AND COALESCE(a.phone, '') = COALESCE(l.phone, '');

-- Step 5: Link opportunities to accounts via their lead
UPDATE public.opportunities o
SET account_id = l.account_id
FROM public.leads l
WHERE o.lead_id = l.id AND l.account_id IS NOT NULL;

-- Step 6: Link projects to accounts via their opportunity's lead
UPDATE public.projects p
SET account_id = o.account_id
FROM public.opportunities o
WHERE p.opportunity_id = o.id AND o.account_id IS NOT NULL;

-- Step 7: Merge active_clients data into accounts (by CNPJ)
UPDATE public.accounts a
SET account_owner_id = COALESCE(a.account_owner_id, ac.account_owner_id),
    lifecycle_stage = CASE WHEN a.lifecycle_stage = 'lead' THEN 'client' ELSE a.lifecycle_stage END
FROM public.active_clients ac
WHERE ac.cnpj IS NOT NULL
  AND length(regexp_replace(ac.cnpj, '[^0-9]', '', 'g')) = 14
  AND regexp_replace(a.cnpj, '[^0-9]', '', 'g') = regexp_replace(ac.cnpj, '[^0-9]', '', 'g');
