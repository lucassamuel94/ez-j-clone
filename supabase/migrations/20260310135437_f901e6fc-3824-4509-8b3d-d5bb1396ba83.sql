
CREATE OR REPLACE FUNCTION public.get_closer_activity_metrics(
  p_closer_id uuid DEFAULT NULL,
  p_range_start timestamptz DEFAULT NULL,
  p_range_end timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        AND COALESCE(p.product_type, '') != 'evolucao_ez_chat'
    ),
    'proposals_evolution', (
      SELECT count(*)
      FROM proposals p
      JOIN opportunities o ON o.id = p.opportunity_id AND o.returned_to_sdr = false
      WHERE (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id)
        AND (p_range_start IS NULL OR p.created_at >= p_range_start)
        AND (p_range_end IS NULL OR p.created_at <= p_range_end)
        AND (o.opportunity_type = 'evolution' OR p.product_type = 'evolucao_ez_chat')
    ),
    'activities_by_type', v_activities_by_type
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
