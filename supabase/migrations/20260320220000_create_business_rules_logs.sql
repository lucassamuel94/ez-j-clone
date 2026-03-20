-- Silent log table for Business Rules chat queries (no UI, code-only access)
CREATE TABLE IF NOT EXISTS public.business_rules_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text,
  question text NOT NULL,
  answer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: only admins can read, any authenticated user can insert
ALTER TABLE public.business_rules_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert logs"
  ON public.business_rules_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read logs"
  ON public.business_rules_logs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Index for querying by date
CREATE INDEX idx_business_rules_logs_created_at ON public.business_rules_logs (created_at DESC);
