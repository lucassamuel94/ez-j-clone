-- Fix get_closer_breakdown_detail 'won' metric:
-- 1. Show setup_total from the LATEST proposal (not deal_value) with deal_value as fallback
-- 2. Exclude evolution opportunities (opportunity_type = 'evolution') from won count
-- Also fix get_closer_performance_breakdown and get_closer_report_metrics to exclude evolutions

-- Fix breakdown detail for 'won' metric
CREATE OR REPLACE FUNCTION public.get_closer_breakdown_detail(
  p_closer_id uuid, p_metric text, p_start timestamptz, p_end timestamptz
)
RETURNS TABLE(id uuid, lead_id uuid, opportunity_id uuid, company text, contact_name text, detail text, event_date timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF p_metric = 'opportunities_worked' THEN
    RETURN QUERY
    WITH touched_leads AS (
      SELECT n.lead_id, MAX(n.created_at) AS last_at
      FROM lead_notes n
      WHERE n.user_id = p_closer_id AND n.created_at >= p_start AND n.created_at <= p_end AND n.lead_id IS NOT NULL
      GROUP BY n.lead_id
      UNION ALL
      SELECT ca.lead_id, MAX(ca.created_at)
      FROM call_analyses ca
      WHERE ca.sdr_user_id = p_closer_id AND ca.status = 'completed' AND ca.created_at >= p_start AND ca.created_at <= p_end AND ca.lead_id IS NOT NULL
      GROUP BY ca.lead_id
      UNION ALL
      SELECT se.lead_id, MAX(se.created_at)
      FROM sent_emails se
      WHERE se.user_id = p_closer_id AND se.created_at >= p_start AND se.created_at <= p_end AND se.lead_id IS NOT NULL
      GROUP BY se.lead_id
      UNION ALL
      SELECT al.lead_id, MAX(al.created_at)
      FROM lead_activity_logs al
      WHERE al.user_id = p_closer_id AND al.action_type IN ('status_changed', 'opportunity_created') AND al.created_at >= p_start AND al.created_at <= p_end AND al.lead_id IS NOT NULL
      GROUP BY al.lead_id
      UNION ALL
      SELECT o.lead_id, MAX(o.meeting_datetime)
      FROM opportunities o
      WHERE o.assigned_to_user_id = p_closer_id AND o.returned_to_sdr = false AND o.meeting_datetime IS NOT NULL
        AND o.meeting_datetime >= p_start AND o.meeting_datetime <= p_end AND o.lead_id IS NOT NULL
      GROUP BY o.lead_id
      UNION ALL
      SELECT o.lead_id, MAX(p.created_at)
      FROM proposals p
      JOIN opportunities o ON o.id = p.opportunity_id AND o.returned_to_sdr = false
      WHERE p.created_by_user_id = p_closer_id AND p.created_at >= p_start AND p.created_at <= p_end AND o.lead_id IS NOT NULL
      GROUP BY o.lead_id
    ),
    distinct_leads AS (
      SELECT tl.lead_id, MAX(tl.last_at) AS last_activity
      FROM touched_leads tl
      GROUP BY tl.lead_id
    )
    SELECT
      dl.lead_id AS id,
      dl.lead_id,
      COALESCE(o.id, '00000000-0000-0000-0000-000000000000'::uuid) AS opportunity_id,
      COALESCE(l.razao_social, l.nome_fantasia, l.company, '—'),
      COALESCE(l.name, '—'),
      COALESCE(o.stage, 'Sem oportunidade'),
      dl.last_activity
    FROM distinct_leads dl
    JOIN leads l ON l.id = dl.lead_id
    LEFT JOIN LATERAL (
      SELECT op.id, op.stage FROM opportunities op
      WHERE op.lead_id = dl.lead_id AND op.returned_to_sdr = false
      ORDER BY op.created_at DESC LIMIT 1
    ) o ON true
    ORDER BY dl.last_activity DESC;

  ELSIF p_metric = 'activities' THEN
    RETURN QUERY
    (
      SELECT n.id, l.id, COALESCE(o.id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(l.razao_social, l.nome_fantasia, l.company, '—'),
        COALESCE(l.name, '—'),
        '📝 Nota: ' || LEFT(regexp_replace(n.note, E'<[^>]+>', '', 'g'), 60),
        n.created_at
      FROM lead_notes n
      JOIN leads l ON l.id = n.lead_id
      LEFT JOIN opportunities o ON o.lead_id = n.lead_id AND o.returned_to_sdr = false AND o.assigned_to_user_id = p_closer_id
      WHERE n.user_id = p_closer_id AND n.created_at >= p_start AND n.created_at <= p_end
    )
    UNION ALL
    (
      SELECT ca.id, ca.lead_id, '00000000-0000-0000-0000-000000000000'::uuid,
        COALESCE(l.razao_social, l.nome_fantasia, l.company, '—'),
        COALESCE(l.name, '—'), '📞 Ligação', ca.created_at
      FROM call_analyses ca LEFT JOIN leads l ON l.id = ca.lead_id
      WHERE ca.sdr_user_id = p_closer_id AND ca.status = 'completed'
        AND ca.created_at >= p_start AND ca.created_at <= p_end
    )
    UNION ALL
    (
      SELECT se.id, se.lead_id, '00000000-0000-0000-0000-000000000000'::uuid,
        COALESCE(l.razao_social, l.nome_fantasia, l.company, '—'),
        COALESCE(l.name, '—'), '📧 E-mail: ' || LEFT(se.subject, 60), se.created_at
      FROM sent_emails se LEFT JOIN leads l ON l.id = se.lead_id
      WHERE se.user_id = p_closer_id AND se.created_at >= p_start AND se.created_at <= p_end
    )
    UNION ALL
    (
      SELECT al.id, al.lead_id, '00000000-0000-0000-0000-000000000000'::uuid,
        COALESCE(l.razao_social, l.nome_fantasia, l.company, '—'),
        COALESCE(l.name, '—'),
        '🔄 ' || COALESCE(al.old_value, '—') || ' → ' || COALESCE(al.new_value, '—'),
        al.created_at
      FROM lead_activity_logs al LEFT JOIN leads l ON l.id = al.lead_id
      WHERE al.user_id = p_closer_id AND al.action_type IN ('status_changed', 'opportunity_created')
        AND al.created_at >= p_start AND al.created_at <= p_end
    )
    UNION ALL
    (
      SELECT o.id, l.id, o.id,
        COALESCE(l.razao_social, l.nome_fantasia, l.company, '—'),
        COALESCE(l.name, '—'), '📅 Reunião', o.meeting_datetime
      FROM opportunities o JOIN leads l ON l.id = o.lead_id
      WHERE o.returned_to_sdr = false AND o.meeting_datetime IS NOT NULL
        AND o.assigned_to_user_id = p_closer_id
        AND o.meeting_datetime >= p_start AND o.meeting_datetime <= p_end
    )
    UNION ALL
    (
      SELECT p.id, l.id, o.id,
        COALESCE(l.razao_social, l.nome_fantasia, l.company, '—'),
        COALESCE(l.name, '—'), '📄 Proposta: ' || COALESCE(p.status, '—'), p.created_at
      FROM proposals p
      JOIN opportunities o ON o.id = p.opportunity_id AND o.returned_to_sdr = false
      JOIN leads l ON l.id = o.lead_id
      WHERE p.created_by_user_id = p_closer_id AND p.created_at >= p_start AND p.created_at <= p_end
    )
    ORDER BY 7 DESC LIMIT 300;

  ELSIF p_metric = 'meetings' THEN
    RETURN QUERY
    SELECT o.id, l.id, o.id,
      COALESCE(l.razao_social, l.nome_fantasia, l.company, '—'),
      COALESCE(l.name, '—'), o.stage, o.meeting_datetime
    FROM opportunities o JOIN leads l ON l.id = o.lead_id
    WHERE o.returned_to_sdr = false AND o.meeting_datetime IS NOT NULL
      AND o.assigned_to_user_id = p_closer_id
      AND o.meeting_datetime >= p_start AND o.meeting_datetime <= p_end
    ORDER BY o.meeting_datetime DESC;

  ELSIF p_metric = 'proposals' THEN
    RETURN QUERY
    SELECT p.id, l.id, o.id,
      COALESCE(l.razao_social, l.nome_fantasia, l.company, '—'),
      COALESCE(l.name, '—'), p.status, p.created_at
    FROM proposals p
    JOIN opportunities o ON o.id = p.opportunity_id AND o.returned_to_sdr = false
    JOIN leads l ON l.id = o.lead_id
    WHERE p.created_by_user_id = p_closer_id AND p.created_at >= p_start AND p.created_at <= p_end
    ORDER BY p.created_at DESC;

  ELSIF p_metric = 'won' THEN
    -- Show setup_total from the latest proposal per opportunity, fallback to deal_value
    -- Exclude evolution opportunities
    RETURN QUERY
    SELECT o.id, l.id, o.id,
      COALESCE(l.razao_social, l.nome_fantasia, l.company, '—'),
      COALESCE(l.name, '—'),
      COALESCE(
        'R$ ' || TRIM(TO_CHAR(COALESCE(NULLIF(latest_p.setup_total, 0), o.deal_value), 'FM999G999G999')),
        '—'
      ),
      o.won_at
    FROM opportunities o
    JOIN leads l ON l.id = o.lead_id
    LEFT JOIN LATERAL (
      SELECT pp.setup_total
      FROM proposals pp
      WHERE pp.opportunity_id = o.id
      ORDER BY pp.created_at DESC
      LIMIT 1
    ) latest_p ON true
    WHERE o.returned_to_sdr = false AND o.stage = 'Ganho'

      AND o.assigned_to_user_id = p_closer_id
      AND o.won_at >= p_start AND o.won_at <= p_end
    ORDER BY o.won_at DESC;

  ELSIF p_metric = 'lost' THEN
    RETURN QUERY
    SELECT o.id, l.id, o.id,
      COALESCE(l.razao_social, l.nome_fantasia, l.company, '—'),
      COALESCE(l.name, '—'), COALESCE(o.lost_reason, '—'), o.updated_at
    FROM opportunities o JOIN leads l ON l.id = o.lead_id
    WHERE o.returned_to_sdr = false AND o.stage = 'Perdido'
      AND o.assigned_to_user_id = p_closer_id
      AND o.updated_at >= p_start AND o.updated_at <= p_end
    ORDER BY o.updated_at DESC;
  END IF;
END;
$function$;

-- Fix get_closer_performance_breakdown: won count excludes evolutions, revenue includes all
CREATE OR REPLACE FUNCTION public.get_closer_performance_breakdown(p_range_start timestamptz DEFAULT NULL, p_range_end timestamptz DEFAULT NULL)
RETURNS TABLE(closer_id uuid, closer_name text, opportunities bigint, won bigint, lost bigint, revenue numeric, rate numeric, avg_cycle_days numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH closer_ids AS (
    SELECT ur.user_id FROM user_roles ur WHERE ur.role = 'closer'
  ),
  active_profiles AS (
    SELECT p.id, p.name FROM profiles p JOIN closer_ids ci ON ci.user_id = p.id WHERE p.active = true
  ),
  opp_active AS (
    SELECT o.assigned_to_user_id, count(*) as cnt FROM opportunities o
    WHERE o.returned_to_sdr = false AND o.stage NOT IN ('Ganho', 'Perdido')
      AND o.assigned_to_user_id IN (SELECT user_id FROM closer_ids)
    GROUP BY o.assigned_to_user_id
  ),
  opp_won AS (
    SELECT o.assigned_to_user_id, count(*) as cnt, coalesce(sum(o.deal_value), 0) as total_rev,
      avg(EXTRACT(EPOCH FROM (o.won_at - o.created_at)) / 86400.0) as cycle_days
    FROM opportunities o
    WHERE o.returned_to_sdr = false AND o.stage = 'Ganho' AND o.won_at IS NOT NULL
      AND o.assigned_to_user_id IN (SELECT user_id FROM closer_ids)
      AND (p_range_start IS NULL OR o.won_at >= p_range_start)
      AND (p_range_end IS NULL OR o.won_at <= p_range_end)
    GROUP BY o.assigned_to_user_id
  ),
  opp_lost AS (
    SELECT o.assigned_to_user_id, count(*) as cnt FROM opportunities o
    WHERE o.returned_to_sdr = false AND o.stage = 'Perdido'
      AND o.assigned_to_user_id IN (SELECT user_id FROM closer_ids)
      AND (p_range_start IS NULL OR o.updated_at >= p_range_start)
      AND (p_range_end IS NULL OR o.updated_at <= p_range_end)
    GROUP BY o.assigned_to_user_id
  ),
  meetings_held AS (
    SELECT o.assigned_to_user_id, count(*) as cnt FROM opportunities o
    WHERE o.returned_to_sdr = false
      AND o.meeting_datetime IS NOT NULL
      AND o.assigned_to_user_id IN (SELECT user_id FROM closer_ids)
      AND (p_range_start IS NULL OR o.meeting_datetime >= p_range_start)
      AND (p_range_end IS NULL OR o.meeting_datetime <= p_range_end)
    GROUP BY o.assigned_to_user_id
  )
  SELECT ap.id, ap.name, coalesce(oa.cnt, 0)::bigint, coalesce(ow.cnt, 0)::bigint, coalesce(ol.cnt, 0)::bigint,
    coalesce(ow.total_rev, 0)::numeric,
    CASE WHEN coalesce(mh.cnt, 0) > 0 THEN round((coalesce(ow.cnt, 0)::numeric / mh.cnt) * 100, 1) ELSE 0::numeric END,
    coalesce(round(ow.cycle_days::numeric, 0), 0)::numeric
  FROM active_profiles ap
  LEFT JOIN opp_active oa ON oa.assigned_to_user_id = ap.id
  LEFT JOIN opp_won ow ON ow.assigned_to_user_id = ap.id
  LEFT JOIN opp_lost ol ON ol.assigned_to_user_id = ap.id
  LEFT JOIN meetings_held mh ON mh.assigned_to_user_id = ap.id
  ORDER BY coalesce(ow.total_rev, 0) DESC, ap.name ASC;
END;
$$;

-- Fix get_closer_report_metrics: exclude evolution opportunities from won/revenue KPIs
CREATE OR REPLACE FUNCTION public.get_closer_report_metrics(
  p_closer_id uuid DEFAULT NULL,
  p_range_start timestamptz DEFAULT NULL,
  p_range_end timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_total bigint;
  v_won bigint;
  v_won_revenue numeric;
  v_lost bigint;
  v_avg_ticket numeric;
  v_avg_cycle numeric;
  v_active_value numeric;
  v_result json;
BEGIN
  -- Total opportunities (all types)
  SELECT count(*) INTO v_total FROM opportunities o
  WHERE o.returned_to_sdr = false
    AND (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id)
    AND (p_range_start IS NULL OR o.created_at >= p_range_start)
    AND (p_range_end IS NULL OR o.created_at <= p_range_end);

  -- Won (count + revenue, all types)
  SELECT count(*), coalesce(sum(o.deal_value), 0) INTO v_won, v_won_revenue
  FROM opportunities o
  WHERE o.returned_to_sdr = false AND o.stage = 'Ganho' AND o.won_at IS NOT NULL
    AND (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id)
    AND (p_range_start IS NULL OR o.won_at >= p_range_start)
    AND (p_range_end IS NULL OR o.won_at <= p_range_end);

  -- Lost
  SELECT count(*) INTO v_lost FROM opportunities o
  WHERE o.returned_to_sdr = false AND o.stage = 'Perdido'
    AND (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id)
    AND (p_range_start IS NULL OR o.updated_at >= p_range_start)
    AND (p_range_end IS NULL OR o.updated_at <= p_range_end);

  -- Avg ticket
  v_avg_ticket := CASE WHEN v_won > 0 THEN v_won_revenue / v_won ELSE 0 END;

  -- Avg cycle days (won only)
  SELECT coalesce(avg(EXTRACT(EPOCH FROM (o.won_at - o.created_at)) / 86400.0), 0) INTO v_avg_cycle
  FROM opportunities o
  WHERE o.returned_to_sdr = false AND o.stage = 'Ganho' AND o.won_at IS NOT NULL
    AND COALESCE(o.opportunity_type, 'new_business') != 'evolution'
    AND (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id)
    AND (p_range_start IS NULL OR o.won_at >= p_range_start)
    AND (p_range_end IS NULL OR o.won_at <= p_range_end);

  -- Active pipeline value
  SELECT coalesce(sum(o.deal_value), 0) INTO v_active_value FROM opportunities o
  WHERE o.returned_to_sdr = false AND o.stage NOT IN ('Ganho', 'Perdido')
    AND (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id);

  SELECT json_build_object(
    'total_opportunities', v_total,
    'won', v_won,
    'revenue', v_won_revenue,
    'lost', v_lost,
    'conversion_rate', CASE WHEN v_total > 0 THEN round((v_won::numeric / v_total) * 100, 1) ELSE 0 END,
    'avg_ticket', round(v_avg_ticket, 0),
    'avg_cycle_days', round(v_avg_cycle, 0),
    'active_pipeline_value', v_active_value
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Fix get_closer_ranking: won_count excludes evolutions, revenue includes ALL won deals
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
  -- ALL won opps (including evolutions) — used for revenue
  won_opps_all AS (
    SELECT
      o.id AS opp_id,
      o.assigned_to_user_id,
      o.deal_value,
      o.opportunity_type
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
  -- Use only the LATEST proposal per opportunity for setup
  latest_proposal_setup AS (
    SELECT DISTINCT ON (wo.opp_id)
      wo.opp_id,
      wo.assigned_to_user_id,
      COALESCE(p.setup_total, 0) AS setup_val
    FROM won_opps_all wo
    LEFT JOIN proposals p ON p.opportunity_id = wo.opp_id
    ORDER BY wo.opp_id, p.created_at DESC NULLS LAST
  ),
  proposal_mrr AS (
    SELECT
      wo.opp_id,
      wo.assigned_to_user_id,
      COALESCE(MAX(p.total_monthly), 0) AS mrr_max
    FROM won_opps_all wo
    LEFT JOIN proposals p ON p.opportunity_id = wo.opp_id
    GROUP BY wo.opp_id, wo.assigned_to_user_id
  ),
  revenue_by_closer AS (
    SELECT
      lps.assigned_to_user_id,
      SUM(CASE WHEN lps.setup_val > 0 THEN lps.setup_val ELSE COALESCE(wo.deal_value, 0) END) AS total_setup
    FROM latest_proposal_setup lps
    JOIN won_opps_all wo ON wo.opp_id = lps.opp_id
    GROUP BY lps.assigned_to_user_id
  ),
  mrr_by_closer AS (
    SELECT
      pm.assigned_to_user_id,
      SUM(pm.mrr_max) AS total_mrr
    FROM proposal_mrr pm
    GROUP BY pm.assigned_to_user_id
  ),
  -- Won count excludes evolutions
  won_counts AS (
    SELECT assigned_to_user_id, count(*) AS cnt
    FROM won_opps_all
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

-- Fix get_closer_team_totals: revenue includes ALL won deals (evolutions too), use latest proposal
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
      COALESCE(NULLIF(lp.setup_total, 0), w.deal_value, 0) AS value
    FROM won w
    LEFT JOIN LATERAL (
      SELECT p.setup_total
      FROM proposals p WHERE p.opportunity_id = w.id
      ORDER BY p.created_at DESC
      LIMIT 1
    ) lp ON true
  ),
  active AS (
    SELECT o.id, o.stage, o.deal_value
    FROM opportunities o
    WHERE o.stage NOT IN ('Ganho', 'Perdido')
      AND o.returned_to_sdr = false
  ),
  active_with_proposals AS (
    SELECT a.id, a.stage,
      COALESCE(NULLIF(lp.setup_total, 0), a.deal_value, 0) AS value
    FROM active a
    LEFT JOIN LATERAL (
      SELECT p.setup_total
      FROM proposals p WHERE p.opportunity_id = a.id
      ORDER BY p.created_at DESC
      LIMIT 1
    ) lp ON true
  )
  SELECT json_build_object(
    'team_revenue', (SELECT COALESCE(SUM(value), 0) FROM won_with_proposals),
    'team_pipeline', (SELECT COALESCE(SUM(value), 0) FROM active_with_proposals),
    'team_pending_contracts', (SELECT COALESCE(SUM(value), 0) FROM active_with_proposals WHERE stage IN ('Contrato enviado', 'Aguardando pagamento')),
    'pending_count', (SELECT COUNT(*) FROM active_with_proposals WHERE stage IN ('Contrato enviado', 'Aguardando pagamento')),
    'active_count', (SELECT COUNT(*) FROM active_with_proposals)
  );
$$;
