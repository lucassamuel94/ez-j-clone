
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
      p.created_by_user_id AS cid,
      count(*) AS total_proposals
    FROM proposals p
    JOIN opportunities o ON o.id = p.opportunity_id AND o.returned_to_sdr = false
    WHERE (p_range_start IS NULL OR p.created_at >= p_range_start)
      AND (p_range_end IS NULL OR p.created_at <= p_range_end)
      AND p.created_by_user_id IN (SELECT user_id FROM closer_users)
    GROUP BY p.created_by_user_id
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

CREATE OR REPLACE FUNCTION public.get_closer_breakdown_detail(
  p_closer_id uuid,
  p_metric text,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE(
  id uuid,
  lead_id uuid,
  opportunity_id uuid,
  company text,
  contact_name text,
  detail text,
  event_date timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF p_metric = 'opportunities_worked' THEN
    RETURN QUERY
    SELECT DISTINCT ON (o.id)
      o.id,
      l.id AS lead_id,
      o.id AS opportunity_id,
      COALESCE(l.razao_social, l.nome_fantasia, l.company, '—') AS company,
      COALESCE(l.name, '—') AS contact_name,
      o.stage AS detail,
      MAX(n.created_at) AS event_date
    FROM lead_notes n
    JOIN opportunities o ON o.lead_id = n.lead_id AND o.returned_to_sdr = false
    JOIN leads l ON l.id = o.lead_id
    WHERE n.user_id = p_closer_id
      AND o.assigned_to_user_id = p_closer_id
      AND n.created_at >= p_start
      AND n.created_at <= p_end
    GROUP BY o.id, l.id, l.razao_social, l.nome_fantasia, l.company, l.name, o.stage
    ORDER BY o.id, MAX(n.created_at) DESC;

  ELSIF p_metric = 'activities' THEN
    RETURN QUERY
    SELECT
      n.id,
      l.id AS lead_id,
      o.id AS opportunity_id,
      COALESCE(l.razao_social, l.nome_fantasia, l.company, '—') AS company,
      COALESCE(l.name, '—') AS contact_name,
      LEFT(regexp_replace(n.note, E'<[^>]+>', '', 'g'), 80) AS detail,
      n.created_at AS event_date
    FROM lead_notes n
    JOIN opportunities o ON o.lead_id = n.lead_id AND o.returned_to_sdr = false
    JOIN leads l ON l.id = o.lead_id
    WHERE n.user_id = p_closer_id
      AND o.assigned_to_user_id = p_closer_id
      AND n.created_at >= p_start
      AND n.created_at <= p_end
    ORDER BY n.created_at DESC
    LIMIT 200;

  ELSIF p_metric = 'meetings' THEN
    RETURN QUERY
    SELECT
      o.id,
      l.id AS lead_id,
      o.id AS opportunity_id,
      COALESCE(l.razao_social, l.nome_fantasia, l.company, '—') AS company,
      COALESCE(l.name, '—') AS contact_name,
      o.stage AS detail,
      o.meeting_datetime AS event_date
    FROM opportunities o
    JOIN leads l ON l.id = o.lead_id
    WHERE o.returned_to_sdr = false
      AND o.meeting_datetime IS NOT NULL
      AND o.assigned_to_user_id = p_closer_id
      AND o.meeting_datetime >= p_start
      AND o.meeting_datetime <= p_end
    ORDER BY o.meeting_datetime DESC;

  ELSIF p_metric = 'proposals' THEN
    RETURN QUERY
    SELECT
      p.id,
      l.id AS lead_id,
      o.id AS opportunity_id,
      COALESCE(l.razao_social, l.nome_fantasia, l.company, '—') AS company,
      COALESCE(l.name, '—') AS contact_name,
      COALESCE(p.product_type, 'setup') || ' — ' || COALESCE(p.setup_total::text, '0') AS detail,
      p.created_at AS event_date
    FROM proposals p
    JOIN opportunities o ON o.id = p.opportunity_id AND o.returned_to_sdr = false
    JOIN leads l ON l.id = o.lead_id
    WHERE p.created_by_user_id = p_closer_id
      AND p.created_at >= p_start
      AND p.created_at <= p_end
    ORDER BY p.created_at DESC;

  END IF;
END;
$$;
