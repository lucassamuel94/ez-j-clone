
-- 1. Add behavioral score columns to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS behavioral_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_variation_48h integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_variation_reason text,
  ADD COLUMN IF NOT EXISTS ai_next_action_suggestion text,
  ADD COLUMN IF NOT EXISTS closing_probability integer,
  ADD COLUMN IF NOT EXISTS closing_probability_reason text,
  ADD COLUMN IF NOT EXISTS is_hot_lead boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_score_calculated_at timestamptz;

-- 2. Score history table for tracking changes over time
CREATE TABLE public.lead_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  score integer NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  factors jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.lead_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view score history on accessible leads"
ON public.lead_score_history FOR SELECT
USING (EXISTS (
  SELECT 1 FROM leads
  WHERE leads.id = lead_score_history.lead_id
  AND (is_manager(auth.uid()) OR leads.owner_user_id = auth.uid() OR leads.owner_user_id IS NULL
    OR EXISTS (SELECT 1 FROM opportunities WHERE opportunities.lead_id = leads.id AND opportunities.assigned_to_user_id = auth.uid()))
));

CREATE POLICY "Service role can insert score history"
ON public.lead_score_history FOR INSERT
WITH CHECK (true);

-- Index for efficient querying
CREATE INDEX idx_lead_score_history_lead_calculated ON public.lead_score_history(lead_id, calculated_at DESC);

-- 3. SDR performance snapshots (visible to managers only)
CREATE TABLE public.sdr_performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_date date NOT NULL DEFAULT CURRENT_DATE,
  avg_response_time_hours numeric DEFAULT 0,
  leads_promoted_to_sqo integer DEFAULT 0,
  leads_lost_without_min_attempts integer DEFAULT 0,
  leads_stalled_count integer DEFAULT 0,
  total_leads integer DEFAULT 0,
  total_interactions integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_date)
);

ALTER TABLE public.sdr_performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view all performance snapshots"
ON public.sdr_performance_snapshots FOR SELECT
USING (is_manager(auth.uid()));

CREATE POLICY "Service role can insert performance snapshots"
ON public.sdr_performance_snapshots FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update performance snapshots"
ON public.sdr_performance_snapshots FOR UPDATE
USING (true);

-- 4. Performance alerts for managers
CREATE TABLE public.performance_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_type text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.performance_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view all performance alerts"
ON public.performance_alerts FOR SELECT
USING (is_manager(auth.uid()));

CREATE POLICY "Service role can insert performance alerts"
ON public.performance_alerts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Managers can update performance alerts"
ON public.performance_alerts FOR UPDATE
USING (is_manager(auth.uid()));

-- 5. Enable realtime for leads score updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_score_history;
