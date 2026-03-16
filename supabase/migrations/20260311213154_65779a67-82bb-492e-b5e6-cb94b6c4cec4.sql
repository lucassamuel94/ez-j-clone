
-- Helper: SQO approval logic in SQL (mirrors calculateSQOVerdict from frontend)
CREATE OR REPLACE FUNCTION public.is_sqo_approved(
  p_pain_category text,
  p_pain_clear boolean,
  p_pain_financial_impact boolean,
  p_urgency text,
  p_budget text,
  p_decision_maker text,
  p_icp_fit text
) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path TO 'public'
AS $$
  SELECT
    p_pain_category IS NOT NULL AND p_pain_category != ''
    AND COALESCE(p_pain_clear, false) = true
    AND COALESCE(p_pain_financial_impact, true) = true  -- false = rejected
    AND p_urgency IS NOT NULL AND p_urgency != '' AND p_urgency != 'longo_prazo'
    AND p_budget IS NOT NULL AND p_budget != '' AND p_budget NOT IN ('nao_caro', 'nao_falou')
    AND p_decision_maker IS NOT NULL AND p_decision_maker != '' AND p_decision_maker != 'outro_nao_mapeado'
    AND p_icp_fit IS NOT NULL AND p_icp_fit != '' AND p_icp_fit != 'nao';
$$;

-- RPC 1: Consolidated execution dashboard stats (replaces ~6 queries)
CREATE OR REPLACE FUNCTION public.get_sdr_execution_stats(
  p_user_ids uuid[],
  p_period_start timestamptz,
  p_month_start timestamptz
) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result json;
BEGIN
  WITH
  -- Period calls (outbound interactions)
  period_calls AS (
    SELECT id, outcome
    FROM interactions
    WHERE direction = 'outbound'
      AND occurred_at >= p_period_start
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  -- Period meetings
  period_meetings AS (
    SELECT id
    FROM meetings
    WHERE created_at >= p_period_start
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  -- Period SQO: opportunities → leads with SQO fields
  period_sqo AS (
    SELECT count(*) AS cnt
    FROM opportunities o
    JOIN leads l ON l.id = o.lead_id
    WHERE o.created_at >= p_period_start
      AND (p_user_ids IS NULL OR o.sdr_user_id = ANY(p_user_ids) OR o.created_by_user_id = ANY(p_user_ids))
      AND public.is_sqo_approved(
        l.sqo_pain_category, l.sqo_pain_clear, l.sqo_pain_financial_impact,
        l.sqo_urgency, l.sqo_budget, l.sqo_decision_maker, l.sqo_icp_fit
      )
  ),
  -- Month calls
  month_calls AS (
    SELECT id, outcome
    FROM interactions
    WHERE direction = 'outbound'
      AND occurred_at >= p_month_start
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  -- Month meetings
  month_meetings AS (
    SELECT id
    FROM meetings
    WHERE created_at >= p_month_start
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  -- Month SQO
  month_sqo AS (
    SELECT count(*) AS cnt
    FROM opportunities o
    JOIN leads l ON l.id = o.lead_id
    WHERE o.created_at >= p_month_start
      AND (p_user_ids IS NULL OR o.sdr_user_id = ANY(p_user_ids) OR o.created_by_user_id = ANY(p_user_ids))
      AND public.is_sqo_approved(
        l.sqo_pain_category, l.sqo_pain_clear, l.sqo_pain_financial_impact,
        l.sqo_urgency, l.sqo_budget, l.sqo_decision_maker, l.sqo_icp_fit
      )
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
$$;

-- RPC 2: Consolidated stats comparison (replaces ~10 queries in useSDRStats)
CREATE OR REPLACE FUNCTION public.get_sdr_stats_comparison(
  p_user_ids uuid[],
  p_current_start timestamptz,
  p_current_end timestamptz,
  p_previous_start timestamptz,
  p_previous_end timestamptz
) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result json;
BEGIN
  WITH
  -- Current period calls
  cur_calls AS (
    SELECT id, outcome FROM interactions
    WHERE direction = 'outbound'
      AND occurred_at >= p_current_start AND occurred_at <= p_current_end
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  -- Previous period calls
  prev_calls AS (
    SELECT id, outcome FROM interactions
    WHERE direction = 'outbound'
      AND occurred_at >= p_previous_start AND occurred_at < p_previous_end
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  -- Current meetings count
  cur_meetings_cnt AS (
    SELECT count(*) AS cnt FROM meetings
    WHERE created_at >= p_current_start AND created_at <= p_current_end
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  -- Previous meetings count
  prev_meetings_cnt AS (
    SELECT count(*) AS cnt FROM meetings
    WHERE created_at >= p_previous_start AND created_at < p_previous_end
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  -- Current confirmed (status transitions)
  cur_confirmed AS (
    SELECT count(*) AS cnt FROM lead_activity_logs
    WHERE action_type = 'status_changed' AND new_value = 'Oportunidade criada'
      AND created_at >= p_current_start AND created_at <= p_current_end
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  -- Previous confirmed
  prev_confirmed AS (
    SELECT count(*) AS cnt FROM lead_activity_logs
    WHERE action_type = 'status_changed' AND new_value = 'Oportunidade criada'
      AND created_at >= p_previous_start AND created_at < p_previous_end
      AND (p_user_ids IS NULL OR user_id = ANY(p_user_ids))
  ),
  -- Current SQO approved count
  cur_sqo AS (
    SELECT count(*) AS cnt
    FROM opportunities o
    JOIN leads l ON l.id = o.lead_id
    WHERE o.created_at >= p_current_start AND o.created_at <= p_current_end
      AND (p_user_ids IS NULL OR o.sdr_user_id = ANY(p_user_ids) OR o.created_by_user_id = ANY(p_user_ids))
      AND public.is_sqo_approved(
        l.sqo_pain_category, l.sqo_pain_clear, l.sqo_pain_financial_impact,
        l.sqo_urgency, l.sqo_budget, l.sqo_decision_maker, l.sqo_icp_fit
      )
  ),
  -- Previous SQO approved count
  prev_sqo AS (
    SELECT count(*) AS cnt
    FROM opportunities o
    JOIN leads l ON l.id = o.lead_id
    WHERE o.created_at >= p_previous_start AND o.created_at < p_previous_end
      AND (p_user_ids IS NULL OR o.sdr_user_id = ANY(p_user_ids) OR o.created_by_user_id = ANY(p_user_ids))
      AND public.is_sqo_approved(
        l.sqo_pain_category, l.sqo_pain_clear, l.sqo_pain_financial_impact,
        l.sqo_urgency, l.sqo_budget, l.sqo_decision_maker, l.sqo_icp_fit
      )
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
$$;
