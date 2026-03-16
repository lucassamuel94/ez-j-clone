
-- Add columns to persist AI enrichment and validation data
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS ai_enrichment_data jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_validation_alerts jsonb DEFAULT NULL;
