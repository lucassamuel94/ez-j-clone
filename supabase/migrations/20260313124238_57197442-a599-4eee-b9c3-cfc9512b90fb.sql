
-- 1. Create api_oficial_deals table
CREATE TABLE public.api_oficial_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  stage TEXT NOT NULL DEFAULT 'Acionar',
  assigned_to_user_id UUID,
  created_by_user_id UUID NOT NULL,
  sdr_user_id UUID,
  notes TEXT,
  lost_reason TEXT,
  lead_name TEXT,
  lead_company TEXT,
  lead_cnpj TEXT,
  lead_phone TEXT,
  lead_email TEXT,
  lead_website TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.api_oficial_deals ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies
CREATE POLICY "Authenticated users can select api_oficial_deals"
  ON public.api_oficial_deals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert api_oficial_deals"
  ON public.api_oficial_deals FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update api_oficial_deals"
  ON public.api_oficial_deals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete api_oficial_deals"
  ON public.api_oficial_deals FOR DELETE TO authenticated USING (true);

-- 4. Index for performance
CREATE INDEX idx_api_oficial_deals_stage ON public.api_oficial_deals (stage);
CREATE INDEX idx_api_oficial_deals_assigned ON public.api_oficial_deals (assigned_to_user_id);

-- 5. Expand pipeline_statuses pipeline column to support 'api_oficial'
-- The column is TEXT so it already supports any value. Just insert default statuses.
