
-- Add columns to persist error and duplicate details in import_jobs
ALTER TABLE public.import_jobs
ADD COLUMN IF NOT EXISTS error_details jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS duplicate_details jsonb DEFAULT '[]'::jsonb;
