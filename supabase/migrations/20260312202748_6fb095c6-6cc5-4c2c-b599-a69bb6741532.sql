
-- 1. Add sqo_approved_at and sqo_approved_by to leads
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS sqo_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS sqo_approved_by uuid;

-- 2. Create trigger to auto-stamp SQO approval (once only)
CREATE OR REPLACE FUNCTION public.stamp_sqo_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- If already approved, never overwrite
  IF NEW.sqo_approved_at IS NOT NULL THEN
    -- Prevent clearing the approval
    NEW.sqo_approved_at := OLD.sqo_approved_at;
    NEW.sqo_approved_by := OLD.sqo_approved_by;
    RETURN NEW;
  END IF;

  -- Check if the lead now passes SQO validation
  IF public.is_sqo_approved(
    NEW.sqo_pain_category, NEW.sqo_pain_clear, NEW.sqo_pain_financial_impact,
    NEW.sqo_urgency, NEW.sqo_budget, NEW.sqo_decision_maker, NEW.sqo_icp_fit
  ) THEN
    NEW.sqo_approved_at := now();
    NEW.sqo_approved_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_sqo_approval ON public.leads;
CREATE TRIGGER trg_stamp_sqo_approval
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_sqo_approval();

-- 3. Backfill existing leads that already meet SQO criteria
UPDATE public.leads
SET sqo_approved_at = updated_at
WHERE sqo_approved_at IS NULL
  AND public.is_sqo_approved(
    sqo_pain_category, sqo_pain_clear, sqo_pain_financial_impact,
    sqo_urgency, sqo_budget, sqo_decision_maker, sqo_icp_fit
  );

-- 4. Update get_sdr_execution_stats to use sqo_approved_at
CREATE OR REPLACE FUNCTION public.get_sdr_execution_stats(p_user_ids uuid[], p_period_start timestamp with time zone, p_month_start timestamp with time zone)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result json;
BEGIN
  WITH
  period_calls AS (
    SELECT id, outcome
    FROM interactions
    WHERE direction = 'outbound'
      AND occurred_at >= p_period_start
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  period_meetings AS (
    SELECT id
    FROM meetings
    WHERE created_at >= p_period_start
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  period_sqo AS (
    SELECT count(*) AS cnt
    FROM leads l
    WHERE l.sqo_approved_at IS NOT NULL
      AND l.sqo_approved_at >= p_period_start
      AND (p_user_ids IS NULL OR l.owner_user_id = ANY(p_user_ids))
  ),
  month_calls AS (
    SELECT id, outcome
    FROM interactions
    WHERE direction = 'outbound'
      AND occurred_at >= p_month_start
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  month_meetings AS (
    SELECT id
    FROM meetings
    WHERE created_at >= p_month_start
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  month_sqo AS (
    SELECT count(*) AS cnt
    FROM leads l
    WHERE l.sqo_approved_at IS NOT NULL
      AND l.sqo_approved_at >= p_month_start
      AND (p_user_ids IS NULL OR l.owner_user_id = ANY(p_user_ids))
  )
  SELECT json_build_object(
    'period_calls', (SELECT count(*) FROM period_calls),
    'period_connected', (SELECT count(*) FROM period_calls WHERE outcome IS NOT NULL AND outcome != 'sem_resposta'),
    'period_meetings', (SELECT count(*) FROM period_meetings),
    'period_sqo', (SELECT cnt FROM period_sqo),
    'month_calls', (SELECT count(*) FROM month_calls),
    'month_connected', (SELECT count(*) FROM month_calls WHERE outcome IS NOT NULL AND outcome != 'sem_resposta'),
    'month_meetings', (SELECT count(*) FROM month_meetings),
    'month_sqo', (SELECT cnt FROM month_sqo)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- 5. Update get_sdr_stats_comparison to use sqo_approved_at
CREATE OR REPLACE FUNCTION public.get_sdr_stats_comparison(p_user_ids uuid[], p_current_start timestamp with time zone, p_current_end timestamp with time zone, p_previous_start timestamp with time zone, p_previous_end timestamp with time zone)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result json;
BEGIN
  WITH
  cur_calls AS (
    SELECT id, outcome FROM interactions
    WHERE direction = 'outbound'
      AND occurred_at >= p_current_start AND occurred_at <= p_current_end
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  prev_calls AS (
    SELECT id, outcome FROM interactions
    WHERE direction = 'outbound'
      AND occurred_at >= p_previous_start AND occurred_at < p_previous_end
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  cur_meetings_cnt AS (
    SELECT count(*) AS cnt FROM meetings
    WHERE created_at >= p_current_start AND created_at <= p_current_end
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  prev_meetings_cnt AS (
    SELECT count(*) AS cnt FROM meetings
    WHERE created_at >= p_previous_start AND created_at < p_previous_end
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  cur_confirmed AS (
    SELECT count(*) AS cnt FROM lead_activity_logs
    WHERE action_type = 'status_changed' AND new_value = 'Oportunidade criada'
      AND created_at >= p_current_start AND created_at <= p_current_end
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  prev_confirmed AS (
    SELECT count(*) AS cnt FROM lead_activity_logs
    WHERE action_type = 'status_changed' AND new_value = 'Oportunidade criada'
      AND created_at >= p_previous_start AND created_at < p_previous_end
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  cur_sqo AS (
    SELECT count(*) AS cnt
    FROM leads l
    WHERE l.sqo_approved_at IS NOT NULL
      AND l.sqo_approved_at >= p_current_start AND l.sqo_approved_at <= p_current_end
      AND (p_user_ids IS NULL OR l.owner_user_id = ANY(p_user_ids))
  ),
  prev_sqo AS (
    SELECT count(*) AS cnt
    FROM leads l
    WHERE l.sqo_approved_at IS NOT NULL
      AND l.sqo_approved_at >= p_previous_start AND l.sqo_approved_at < p_previous_end
      AND (p_user_ids IS NULL OR l.owner_user_id = ANY(p_user_ids))
  )
  SELECT json_build_object(
    'current', json_build_object(
      'callAttempts', (SELECT count(*) FROM cur_calls),
      'completedCalls', (SELECT count(*) FROM cur_calls WHERE outcome IS NOT NULL AND outcome != 'sem_resposta'),
      'totalScheduled', (SELECT cnt FROM cur_meetings_cnt),
      'totalConfirmed', (SELECT cnt FROM cur_confirmed),
      'sqoApproved', (SELECT cnt FROM cur_sqo)
    ),
    'previous', json_build_object(
      'callAttempts', (SELECT count(*) FROM prev_calls),
      'completedCalls', (SELECT count(*) FROM prev_calls WHERE outcome IS NOT NULL AND outcome != 'sem_resposta'),
      'totalScheduled', (SELECT cnt FROM prev_meetings_cnt),
      'totalConfirmed', (SELECT cnt FROM prev_confirmed),
      'sqoApproved', (SELECT cnt FROM prev_sqo)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- 6. Index for fast SQO queries
CREATE INDEX IF NOT EXISTS idx_leads_sqo_approved_at ON public.leads (sqo_approved_at) WHERE sqo_approved_at IS NOT NULL;
