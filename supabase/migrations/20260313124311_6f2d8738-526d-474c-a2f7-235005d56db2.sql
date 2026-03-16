
-- Drop existing check constraint and recreate with api_oficial
ALTER TABLE public.pipeline_statuses DROP CONSTRAINT IF EXISTS pipeline_statuses_pipeline_check;
ALTER TABLE public.pipeline_statuses ADD CONSTRAINT pipeline_statuses_pipeline_check CHECK (pipeline IN ('sdr', 'closer', 'api_oficial'));
