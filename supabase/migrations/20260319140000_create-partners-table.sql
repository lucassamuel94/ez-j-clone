-- ============================================================
-- Partners (Parceiros Comerciais) table + lead linkage
-- ============================================================

CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  partner_type TEXT NOT NULL DEFAULT 'indicador',
  commission_rate NUMERIC(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by_user_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view partners"
  ON public.partners FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Managers and closers can manage partners"
  ON public.partners FOR ALL
  TO authenticated
  USING (
    public.is_manager(auth.uid())
    OR public.has_role(auth.uid(), 'closer'::app_role)
  )
  WITH CHECK (
    public.is_manager(auth.uid())
    OR public.has_role(auth.uid(), 'closer'::app_role)
  );

-- Index for quick lookups
CREATE INDEX idx_partners_status ON public.partners(status);
CREATE INDEX idx_partners_name ON public.partners(name);

-- Add partner_id to leads table
ALTER TABLE public.leads ADD COLUMN partner_id UUID REFERENCES public.partners(id);
CREATE INDEX idx_leads_partner_id ON public.leads(partner_id);

COMMENT ON TABLE public.partners IS 'Commercial partners who refer clients to the sales pipeline';
