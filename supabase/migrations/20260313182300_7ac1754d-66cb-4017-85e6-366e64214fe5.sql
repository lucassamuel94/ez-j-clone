CREATE OR REPLACE FUNCTION get_closer_ranking()
RETURNS TABLE(
  closer_id uuid,
  closer_name text,
  won_count bigint,
  total_count bigint,
  setup_revenue numeric,
  mrr_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_start timestamptz;
BEGIN
  v_month_start := date_trunc('month', now());

  RETURN QUERY
  WITH closer_ids AS (
    SELECT ur.user_id
    FROM user_roles ur
    WHERE ur.role = 'closer'
  ),
  won_opps AS (
    SELECT
      o.id AS opp_id,
      o.assigned_to_user_id,
      o.deal_value
    FROM opportunities o
    INNER JOIN closer_ids ci ON ci.user_id = o.assigned_to_user_id
    WHERE o.stage = 'Ganho'
      AND o.won_at >= v_month_start
      AND o.returned_to_sdr = false
  ),
  all_opps AS (
    SELECT
      o.assigned_to_user_id,
      count(*) AS cnt
    FROM opportunities o
    INNER JOIN closer_ids ci ON ci.user_id = o.assigned_to_user_id
    WHERE o.returned_to_sdr = false
      AND o.created_at >= v_month_start
    GROUP BY o.assigned_to_user_id
  ),
  proposal_setup AS (
    SELECT
      wo.opp_id,
      wo.assigned_to_user_id,
      COALESCE(SUM(p.setup_total), 0) AS setup_sum
    FROM won_opps wo
    LEFT JOIN proposals p ON p.opportunity_id = wo.opp_id
    GROUP BY wo.opp_id, wo.assigned_to_user_id
  ),
  proposal_mrr AS (
    SELECT
      wo.opp_id,
      wo.assigned_to_user_id,
      COALESCE(MAX(p.total_monthly), 0) AS mrr_max
    FROM won_opps wo
    LEFT JOIN proposals p ON p.opportunity_id = wo.opp_id
    GROUP BY wo.opp_id, wo.assigned_to_user_id
  ),
  revenue_by_closer AS (
    SELECT
      ps.assigned_to_user_id,
      SUM(CASE WHEN ps.setup_sum > 0 THEN ps.setup_sum ELSE COALESCE(wo.deal_value, 0) END) AS total_setup
    FROM proposal_setup ps
    JOIN won_opps wo ON wo.opp_id = ps.opp_id
    GROUP BY ps.assigned_to_user_id
  ),
  mrr_by_closer AS (
    SELECT
      pm.assigned_to_user_id,
      SUM(pm.mrr_max) AS total_mrr
    FROM proposal_mrr pm
    GROUP BY pm.assigned_to_user_id
  ),
  won_counts AS (
    SELECT assigned_to_user_id, count(*) AS cnt
    FROM won_opps
    GROUP BY assigned_to_user_id
  )
  SELECT
    ci.user_id AS closer_id,
    COALESCE(pr.name, 'Unknown') AS closer_name,
    COALESCE(wc.cnt, 0) AS won_count,
    COALESCE(ao.cnt, 0) AS total_count,
    COALESCE(rc.total_setup, 0) AS setup_revenue,
    COALESCE(mc.total_mrr, 0) AS mrr_revenue
  FROM closer_ids ci
  LEFT JOIN profiles pr ON pr.id = ci.user_id
  LEFT JOIN won_counts wc ON wc.assigned_to_user_id = ci.user_id
  LEFT JOIN all_opps ao ON ao.assigned_to_user_id = ci.user_id
  LEFT JOIN revenue_by_closer rc ON rc.assigned_to_user_id = ci.user_id
  LEFT JOIN mrr_by_closer mc ON mc.assigned_to_user_id = ci.user_id
  ORDER BY COALESCE(rc.total_setup, 0) DESC;
END;
$$;