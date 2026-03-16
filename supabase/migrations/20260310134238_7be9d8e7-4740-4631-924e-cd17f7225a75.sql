
-- RPC 1: Activity metrics for a single closer (or all closers)
CREATE OR REPLACE FUNCTION public.get_closer_activity_metrics(
  p_closer_id uuid DEFAULT NULL,
  p_range_start timestamptz DEFAULT NULL,
  p_range_end timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result json;
  v_activities_by_type jsonb;
BEGIN
  -- Activities by type
  SELECT COALESCE(jsonb_object_agg(activity_type, cnt), '{}'::jsonb)
  INTO v_activities_by_type
  FROM (
    SELECT
      CASE
        WHEN n.note LIKE '📞%' OR lower(n.note) LIKE '%ligação%' OR lower(n.note) LIKE '%ligacao%' THEN 'Ligação'
        WHEN n.note LIKE '📧%' OR lower(n.note) LIKE '%e-mail%' OR lower(n.note) LIKE '%email%' THEN 'E-mail'
        WHEN lower(n.note) LIKE '%whatsapp%' OR n.note LIKE '%📱%' THEN 'WhatsApp'
        WHEN n.note LIKE '📋%' OR lower(n.note) LIKE '%tarefa%' OR lower(n.note) LIKE '%task%' THEN 'Tarefa'
        WHEN n.note LIKE '📝%' OR lower(n.note) LIKE '%observação%' OR lower(n.note) LIKE '%nota%' THEN 'Observação'
        ELSE 'Outro'
      END AS activity_type,
      count(*) AS cnt
    FROM lead_notes n
    JOIN opportunities o ON o.lead_id = n.lead_id AND o.returned_to_sdr = false
    WHERE (p_closer_id IS NULL OR n.user_id = p_closer_id)
      AND (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id)
      AND (p_range_start IS NULL OR n.created_at >= p_range_start)
      AND (p_range_end IS NULL OR n.created_at <= p_range_end)
    GROUP BY activity_type
  ) sub;

  SELECT json_build_object(
    'opportunities_worked', (
      SELECT count(DISTINCT n.lead_id)
      FROM lead_notes n
      JOIN opportunities o ON o.lead_id = n.lead_id AND o.returned_to_sdr = false
      WHERE (p_closer_id IS NULL OR n.user_id = p_closer_id)
        AND (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id)
        AND (p_range_start IS NULL OR n.created_at >= p_range_start)
        AND (p_range_end IS NULL OR n.created_at <= p_range_end)
    ),
    'total_activities', (
      SELECT count(*)
      FROM lead_notes n
      JOIN opportunities o ON o.lead_id = n.lead_id AND o.returned_to_sdr = false
      WHERE (p_closer_id IS NULL OR n.user_id = p_closer_id)
        AND (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id)
        AND (p_range_start IS NULL OR n.created_at >= p_range_start)
        AND (p_range_end IS NULL OR n.created_at <= p_range_end)
    ),
    'meetings_held', (
      SELECT count(*)
      FROM opportunities o
      WHERE o.returned_to_sdr = false
        AND o.meeting_datetime IS NOT NULL
        AND (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id)
        AND (p_range_start IS NULL OR o.meeting_datetime >= p_range_start)
        AND (p_range_end IS NULL OR o.meeting_datetime <= p_range_end)
    ),
    'proposals_total', (
      SELECT count(*)
      FROM proposals p
      JOIN opportunities o ON o.id = p.opportunity_id AND o.returned_to_sdr = false
      WHERE (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id)
        AND (p_range_start IS NULL OR p.created_at >= p_range_start)
        AND (p_range_end IS NULL OR p.created_at <= p_range_end)
    ),
    'proposals_new', (
      SELECT count(*)
      FROM proposals p
      JOIN opportunities o ON o.id = p.opportunity_id AND o.returned_to_sdr = false
      WHERE (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id)
        AND (p_range_start IS NULL OR p.created_at >= p_range_start)
        AND (p_range_end IS NULL OR p.created_at <= p_range_end)
        AND COALESCE(o.opportunity_type, 'new_business') != 'evolution'
    ),
    'proposals_evolution', (
      SELECT count(*)
      FROM proposals p
      JOIN opportunities o ON o.id = p.opportunity_id AND o.returned_to_sdr = false
      WHERE (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id)
        AND (p_range_start IS NULL OR p.created_at >= p_range_start)
        AND (p_range_end IS NULL OR p.created_at <= p_range_end)
        AND o.opportunity_type = 'evolution'
    ),
    'activities_by_type', v_activities_by_type
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- RPC 2: Activity breakdown per closer
CREATE OR REPLACE FUNCTION public.get_closer_activity_breakdown(
  p_range_start timestamptz DEFAULT NULL,
  p_range_end timestamptz DEFAULT NULL
)
RETURNS TABLE(
  closer_id uuid,
  closer_name text,
  opportunities_worked bigint,
  activities bigint,
  meetings bigint,
  proposals bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH closer_users AS (
    SELECT ur.user_id, pr.name
    FROM user_roles ur
    JOIN profiles pr ON pr.id = ur.user_id AND pr.active = true
    WHERE ur.role IN ('closer', 'admin', 'manager')
  ),
  activity_counts AS (
    SELECT
      n.user_id AS cid,
      count(*) AS total_activities,
      count(DISTINCT n.lead_id) AS opps_worked
    FROM lead_notes n
    JOIN opportunities o ON o.lead_id = n.lead_id AND o.returned_to_sdr = false
    JOIN closer_users cu ON cu.user_id = n.user_id AND o.assigned_to_user_id = n.user_id
    WHERE (p_range_start IS NULL OR n.created_at >= p_range_start)
      AND (p_range_end IS NULL OR n.created_at <= p_range_end)
    GROUP BY n.user_id
  ),
  meeting_counts AS (
    SELECT
      o.assigned_to_user_id AS cid,
      count(*) AS total_meetings
    FROM opportunities o
    WHERE o.returned_to_sdr = false
      AND o.meeting_datetime IS NOT NULL
      AND (p_range_start IS NULL OR o.meeting_datetime >= p_range_start)
      AND (p_range_end IS NULL OR o.meeting_datetime <= p_range_end)
      AND o.assigned_to_user_id IN (SELECT user_id FROM closer_users)
    GROUP BY o.assigned_to_user_id
  ),
  proposal_counts AS (
    SELECT
      o.assigned_to_user_id AS cid,
      count(*) AS total_proposals
    FROM proposals p
    JOIN opportunities o ON o.id = p.opportunity_id AND o.returned_to_sdr = false
    WHERE (p_range_start IS NULL OR p.created_at >= p_range_start)
      AND (p_range_end IS NULL OR p.created_at <= p_range_end)
      AND o.assigned_to_user_id IN (SELECT user_id FROM closer_users)
    GROUP BY o.assigned_to_user_id
  )
  SELECT
    cu.user_id AS closer_id,
    cu.name AS closer_name,
    COALESCE(ac.opps_worked, 0) AS opportunities_worked,
    COALESCE(ac.total_activities, 0) AS activities,
    COALESCE(mc.total_meetings, 0) AS meetings,
    COALESCE(pc.total_proposals, 0) AS proposals
  FROM closer_users cu
  LEFT JOIN activity_counts ac ON ac.cid = cu.user_id
  LEFT JOIN meeting_counts mc ON mc.cid = cu.user_id
  LEFT JOIN proposal_counts pc ON pc.cid = cu.user_id
  WHERE COALESCE(ac.total_activities, 0) > 0
     OR COALESCE(mc.total_meetings, 0) > 0
     OR COALESCE(pc.total_proposals, 0) > 0
  ORDER BY COALESCE(ac.total_activities, 0) DESC;
END;
$$;
