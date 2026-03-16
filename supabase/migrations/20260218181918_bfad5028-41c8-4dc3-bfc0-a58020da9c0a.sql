ALTER TABLE public.call_analyses
  ADD COLUMN transcribed_at timestamptz,
  ADD COLUMN completed_at timestamptz;