
-- Create active_clients table
CREATE TABLE public.active_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  cnpj text,
  contact_name text,
  email text,
  phone text,
  segment text,
  razao_social text,
  nome_fantasia text,
  cnae_fiscal integer,
  cnae_fiscal_descricao text,
  cnaes_secundarios text,
  porte text,
  employee_count text,
  revenue_range text,
  capital_social numeric,
  city text,
  state text,
  cep text,
  website text,
  situacao_cadastral text,
  data_inicio_atividade text,
  ai_enrichment_data jsonb,
  enriched_at timestamptz,
  imported_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create icp_analyses table
CREATE TABLE public.icp_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid,
  filters jsonb DEFAULT '{}'::jsonb,
  statistics jsonb DEFAULT '{}'::jsonb,
  ai_analysis text,
  clients_analyzed integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.active_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icp_analyses ENABLE ROW LEVEL SECURITY;

-- RLS for active_clients: admin only
CREATE POLICY "Admins can select active_clients"
  ON public.active_clients FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert active_clients"
  ON public.active_clients FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update active_clients"
  ON public.active_clients FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete active_clients"
  ON public.active_clients FOR DELETE
  USING (is_admin(auth.uid()));

-- RLS for icp_analyses: admin only
CREATE POLICY "Admins can select icp_analyses"
  ON public.icp_analyses FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert icp_analyses"
  ON public.icp_analyses FOR INSERT
  WITH CHECK (is_admin(auth.uid()));
