
-- 1.4 Índices compostos faltantes
CREATE INDEX IF NOT EXISTS idx_interactions_outbound_user_occurred 
  ON public.interactions (direction, user_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_meetings_user_created 
  ON public.meetings (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_lead_activity_logs_status_changed 
  ON public.lead_activity_logs (action_type, new_value, user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_opportunities_sdr_created 
  ON public.opportunities (sdr_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_opportunities_created_by_created 
  ON public.opportunities (created_by_user_id, created_at);

-- 1.1 RPC: get_sdr_alert_counts — retorna contagens de alertas sem full table scan
CREATE OR REPLACE FUNCTION public.get_sdr_alert_counts(p_sdr_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result json;
  v_now timestamptz := now();
BEGIN
  WITH filtered AS (
    SELECT id, status, next_action_at, created_at, is_hot_lead, temperature,
           behavioral_score, last_contact_at
    FROM leads
    WHERE status NOT IN ('Descartado', 'Oportunidade criada')
      AND CASE
        WHEN p_sdr_id IS NULL THEN owner_user_id IS NOT NULL
        WHEN p_sdr_id = '00000000-0000-0000-0000-000000000000'::uuid THEN owner_user_id IS NULL
        ELSE owner_user_id = p_sdr_id
      END
  )
  SELECT json_build_object(
    'hot', (SELECT count(*) FROM filtered WHERE is_hot_lead = true OR temperature = 'hot'),
    'overdue', (SELECT count(*) FROM filtered WHERE next_action_at < v_now),
    'noTask', (SELECT count(*) FROM filtered WHERE abs(extract(epoch from (next_action_at - created_at))) < 60)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
