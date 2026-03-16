ALTER TABLE public.call_analyses
  ADD COLUMN IF NOT EXISTS ezcall_linkedid TEXT,
  ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_call_analyses_ezcall_linkedid
  ON public.call_analyses (ezcall_linkedid)
  WHERE ezcall_linkedid IS NOT NULL;