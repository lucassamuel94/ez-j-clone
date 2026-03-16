ALTER TABLE public.call_analyses
  ADD COLUMN IF NOT EXISTS worker_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS worker_chunk_cursor integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS worker_partial_text text DEFAULT '',
  ADD COLUMN IF NOT EXISTS worker_retry_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS worker_total_chunks integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_call_analyses_stuck
  ON public.call_analyses (status, worker_heartbeat_at)
  WHERE status IN ('processing', 'transcribed');