
-- Table to track background enrichment jobs
CREATE TABLE public.enrichment_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'running',  -- running, completed, failed, cancelled
  total_eligible integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  cnpja_success integer NOT NULL DEFAULT 0,
  perplexity_success integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.enrichment_jobs ENABLE ROW LEVEL SECURITY;

-- Admins/managers can view all jobs
CREATE POLICY "Managers can view enrichment jobs"
  ON public.enrichment_jobs FOR SELECT
  USING (is_manager(auth.uid()));

-- Users can view their own jobs  
CREATE POLICY "Users can view own enrichment jobs"
  ON public.enrichment_jobs FOR SELECT
  USING (started_by = auth.uid());

-- Authenticated users can insert
CREATE POLICY "Authenticated users can insert enrichment jobs"
  ON public.enrichment_jobs FOR INSERT
  WITH CHECK (started_by = auth.uid());

-- Service role can update (edge function)
CREATE POLICY "Service role can update enrichment jobs"
  ON public.enrichment_jobs FOR UPDATE
  USING (true);

-- Users can cancel their own jobs
CREATE POLICY "Users can update own enrichment jobs"
  ON public.enrichment_jobs FOR UPDATE
  USING (started_by = auth.uid());
