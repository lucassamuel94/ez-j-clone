
-- ============================================================
-- PHASE 1a: Create accounts table (without RLS referencing account_id)
-- ============================================================
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj TEXT,
  company_name TEXT NOT NULL,
  razao_social TEXT,
  nome_fantasia TEXT,
  company_segment TEXT,
  employee_count TEXT,
  revenue_range TEXT,
  porte TEXT,
  capital_social NUMERIC,
  cnae_fiscal INTEGER,
  cnae_fiscal_descricao TEXT,
  cnaes_secundarios TEXT,
  situacao_cadastral TEXT,
  data_inicio_atividade TEXT,
  qsa TEXT,
  website TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  ai_enrichment_data JSONB,
  account_owner_id UUID REFERENCES auth.users(id),
  lifecycle_stage TEXT NOT NULL DEFAULT 'lead',
  notes TEXT,
  email TEXT,
  phone TEXT,
  contact_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique index on CNPJ (only for valid 14-digit CNPJs)
CREATE UNIQUE INDEX idx_accounts_cnpj_unique
  ON public.accounts (regexp_replace(cnpj, '[^0-9]', '', 'g'))
  WHERE cnpj IS NOT NULL AND length(regexp_replace(cnpj, '[^0-9]', '', 'g')) = 14;

CREATE INDEX idx_accounts_lifecycle ON public.accounts (lifecycle_stage);
CREATE INDEX idx_accounts_owner ON public.accounts (account_owner_id);

CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS with permissive policies for now (will tighten after account_id columns exist)
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view accounts"
  ON public.accounts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert accounts"
  ON public.accounts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update accounts"
  ON public.accounts FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete accounts"
  ON public.accounts FOR DELETE USING (public.is_admin(auth.uid()));

-- ============================================================
-- PHASE 1b: Add account_id to leads, opportunities, projects
-- ============================================================
ALTER TABLE public.leads ADD COLUMN account_id UUID REFERENCES public.accounts(id);
ALTER TABLE public.opportunities ADD COLUMN account_id UUID REFERENCES public.accounts(id);
ALTER TABLE public.projects ADD COLUMN account_id UUID REFERENCES public.accounts(id);

CREATE INDEX idx_leads_account ON public.leads (account_id);
CREATE INDEX idx_opportunities_account ON public.opportunities (account_id);
CREATE INDEX idx_projects_account ON public.projects (account_id);
