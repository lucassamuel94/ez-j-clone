
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    WHERE o.assigned_to_user_id = p_closer_id
      AND p.created_at >= p_start
      AND p.created_at <= p_end
    ORDER BY p.created_at DESC;

  END IF;
END;
$function$;
