
-- Add columns to enrichment_jobs for CNPJá background processing
ALTER TABLE public.enrichment_jobs 
  ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT 'enrich',
  ADD COLUMN IF NOT EXISTS not_found_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skipped_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_processed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Enable realtime for enrichment_jobs so UI can poll progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.enrichment_jobs;
