CREATE OR REPLACE FUNCTION public.get_sdr_team_totals()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH month_start AS (
    SELECT date_trunc('month', now()) AS dt
  ),
  sdr_users AS (
    SELECT user_id FROM user_roles WHERE role = 'sdr'
  ),
  agendados AS (
    SELECT COUNT(*) AS total
    FROM meetings m
    JOIN sdr_users s ON s.user_id = m.user_id
    WHERE m.created_at >= (SELECT dt FROM month_start)
  ),
  confirmados AS (
    SELECT COUNT(*) AS total
    FROM lead_activity_logs l
    JOIN sdr_users s ON s.user_id = l.user_id
    WHERE l.action_type = 'opportunity_created'
      AND l.description ILIKE '%confirmou presença%'
      AND l.created_at >= (SELECT dt FROM month_start)
  ),
  sqo AS (
    SELECT COUNT(*) AS total
    FROM leads l
    JOIN sdr_users s ON s.user_id = l.owner_user_id
    WHERE l.sqo_approved_at IS NOT NULL
      AND l.sqo_approved_at >= (SELECT dt FROM month_start)
  )
  SELECT json_build_object(
    'total_agendado', (SELECT total FROM agendados),
    'total_confirmado', (SELECT total FROM confirmados),
    'total_sqo', (SELECT total FROM sqo)
  );
$$;