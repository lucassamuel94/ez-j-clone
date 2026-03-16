CREATE OR REPLACE FUNCTION public.get_closer_performance_breakdown(
  p_range_start timestamptz DEFAULT NULL,
  p_range_end timestamptz DEFAULT NULL
)
RETURNS TABLE (
  closer_id uuid,
  closer_name text,
  opportunities bigint,
  won bigint,
  lost bigint,
  revenue numeric,
  rate numeric
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  WITH closer_ids AS (
    SELECT ur.user_id
    FROM user_roles ur
    WHERE ur.role IN ('closer', 'admin', 'manager')
  ),
  active_profiles AS (
    SELECT p.id, p.name
    FROM profiles p
    JOIN closer_ids ci ON ci.user_id = p.id
    WHERE p.active = true
  ),
  opp_active AS (
    SELECT o.assigned_to_user_id, count(*) as cnt
    FROM opportunities o
    WHERE o.returned_to_sdr = false
      AND o.stage NOT IN ('Ganho', 'Perdido')
      AND o.assigned_to_user_id IN (SELECT user_id FROM closer_ids)
    GROUP BY o.assigned_to_user_id
  ),
  opp_won AS (
    SELECT o.assigned_to_user_id, count(*) as cnt, coalesce(sum(o.deal_value), 0) as total_rev
    FROM opportunities o
    WHERE o.returned_to_sdr = false
      AND o.stage = 'Ganho'
      AND o.assigned_to_user_id IN (SELECT user_id FROM closer_ids)
      AND (p_range_start IS NULL OR o.updated_at >= p_range_start)
      AND (p_range_end IS NULL OR o.updated_at <= p_range_end)
    GROUP BY o.assigned_to_user_id
  ),
  opp_lost AS (
    SELECT o.assigned_to_user_id, count(*) as cnt
    FROM opportunities o
    WHERE o.returned_to_sdr = false
      AND o.stage = 'Perdido'
      AND o.assigned_to_user_id IN (SELECT user_id FROM closer_ids)
      AND (p_range_start IS NULL OR o.updated_at >= p_range_start)
      AND (p_range_end IS NULL OR o.updated_at <= p_range_end)
    GROUP BY o.assigned_to_user_id
  )
  SELECT
    ap.id as closer_id,
    ap.name as closer_name,
    coalesce(oa.cnt, 0) as opportunities,
    coalesce(ow.cnt, 0) as won,
    coalesce(ol.cnt, 0) as lost,
    coalesce(ow.total_rev, 0) as revenue,
    CASE WHEN coalesce(oa.cnt, 0) > 0
      THEN round((coalesce(ow.cnt, 0)::numeric / oa.cnt) * 100, 1)
      ELSE 0
    END as rate
  FROM active_profiles ap
  LEFT JOIN opp_active oa ON oa.assigned_to_user_id = ap.id
  LEFT JOIN opp_won ow ON ow.assigned_to_user_id = ap.id
  LEFT JOIN opp_lost ol ON ol.assigned_to_user_id = ap.id
  ORDER BY coalesce(ow.total_rev, 0) DESC, ap.name ASC;
$$;