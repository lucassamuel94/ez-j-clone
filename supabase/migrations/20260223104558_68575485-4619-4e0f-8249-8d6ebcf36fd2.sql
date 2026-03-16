
-- Table to track bulk reassignment jobs (persists even if browser closes)
CREATE TABLE public.bulk_reassign_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module text NOT NULL DEFAULT 'sdr', -- 'sdr' or 'closer'
  entity_ids uuid[] NOT NULL DEFAULT '{}',
  target_user_id uuid NOT NULL,
  distribution_mode text NOT NULL DEFAULT 'specific', -- 'specific', 'auto_all', 'auto_selected'
  target_user_ids uuid[] DEFAULT '{}', -- for auto_selected mode
  total_count integer NOT NULL DEFAULT 0,
  processed_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending, running, completed, error
  error_message text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bulk_reassign_jobs ENABLE ROW LEVEL SECURITY;

-- Only managers/admins can create jobs
CREATE POLICY "Managers can insert reassign jobs"
  ON public.bulk_reassign_jobs FOR INSERT
  WITH CHECK (is_manager(auth.uid()) AND created_by = auth.uid());

-- Users can view their own jobs, managers can view all
CREATE POLICY "Users can view own reassign jobs"
  ON public.bulk_reassign_jobs FOR SELECT
  USING (created_by = auth.uid() OR is_manager(auth.uid()));

-- Service role updates progress
CREATE POLICY "Service role can update reassign jobs"
  ON public.bulk_reassign_jobs FOR UPDATE
  USING (true);

-- Managers can delete
CREATE POLICY "Managers can delete reassign jobs"
  ON public.bulk_reassign_jobs FOR DELETE
  USING (is_manager(auth.uid()));

-- Enable realtime for progress polling
ALTER PUBLICATION supabase_realtime ADD TABLE public.bulk_reassign_jobs;
