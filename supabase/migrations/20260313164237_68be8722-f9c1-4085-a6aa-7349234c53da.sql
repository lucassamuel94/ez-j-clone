CREATE OR REPLACE FUNCTION public.get_closer_team_totals()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH month_start AS (
    SELECT date_trunc('month', now()) AS dt
  ),
  won AS (
    SELECT o.id, o.deal_value
    FROM opportunities o, month_start ms
    WHERE o.stage = 'Ganho'
      AND o.won_at >= ms.dt
      AND o.returned_to_sdr = false
  ),
  won_with_proposals AS (
    SELECT w.id,
      COALESCE(NULLIF(ps.setup_sum, 0), w.deal_value, 0) AS value
    FROM won w
    LEFT JOIN LATERAL (
      SELECT SUM(p.setup_total) AS setup_sum
      FROM proposals p WHERE p.opportunity_id = w.id
    ) ps ON true
  ),
  active AS (
    SELECT o.id, o.stage, o.deal_value
    FROM opportunities o
    WHERE o.stage NOT IN ('Ganho', 'Perdido')
      AND o.returned_to_sdr = false
  ),
  active_with_proposals AS (
    SELECT a.id, a.stage,
      COALESCE(NULLIF(ps.setup_sum, 0), a.deal_value, 0) AS value
    FROM active a
    LEFT JOIN LATERAL (
      SELECT SUM(p.setup_total) AS setup_sum
      FROM proposals p WHERE p.opportunity_id = a.id
    ) ps ON true
  )
  SELECT json_build_object(
    'team_revenue', (SELECT COALESCE(SUM(value), 0) FROM won_with_proposals),
    'team_pipeline', (SELECT COALESCE(SUM(value), 0) FROM active_with_proposals),
    'team_pending_contracts', (SELECT COALESCE(SUM(value), 0) FROM active_with_proposals WHERE stage IN ('Contrato enviado', 'Aguardando pagamento')),
    'pending_count', (SELECT COUNT(*) FROM active_with_proposals WHERE stage IN ('Contrato enviado', 'Aguardando pagamento')),
    'active_count', (SELECT COUNT(*) FROM active_with_proposals)
  );
$$;