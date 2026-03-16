
-- Add field to track when CNPJá was last searched for each lead
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cnpja_last_searched_at timestamp with time zone DEFAULT NULL;

-- Index for efficient filtering during bulk enrichment
CREATE INDEX IF NOT EXISTS idx_leads_cnpja_last_searched_at ON public.leads (cnpja_last_searched_at);
