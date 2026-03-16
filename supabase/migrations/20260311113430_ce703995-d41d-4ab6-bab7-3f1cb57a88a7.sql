
-- Update get_closer_activity_breakdown: opportunities_worked now counts distinct leads from ALL 6 sources
CREATE OR REPLACE FUNCTION public.get_closer_activity_breakdown(
  p_range_start timestamptz DEFAULT NULL,
  p_range_end timestamptz DEFAULT NULL
)
RETURNS TABLE(
  closer_id uuid,
  closer_name text,
  opportunities_worked bigint,
  activities bigint,
  calls bigint,
  emails bigint,
  stage_changes bigint,
  meetings bigint,
  proposals bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH closer_users AS (
    SELECT ur.user_id, pr.name
    FROM user_roles ur
    JOIN profiles pr ON pr.id = ur.user_id AND pr.active = true
    WHERE ur.role IN ('closer', 'admin', 'manager')
  ),
  -- All touched leads per closer (UNION ALL for distinct lead counting)
  all_touched AS (
    SELECT n.user_id AS cid, n.lead_id
    FROM lead_notes n
    WHERE (p_range_start IS NULL OR n.created_at >= p_range_start)
      AND (p_range_end IS NULL OR n.created_at <= p_range_end)
      AND n.user_id IN (SELECT user_id FROM closer_users)
    UNION ALL
    SELECT ca.sdr_user_id, ca.lead_id
    FROM call_analyses ca
    WHERE ca.status = 'completed' AND ca.lead_id IS NOT NULL
      AND (p_range_start IS NULL OR ca.created_at >= p_range_start)
      AND (p_range_end IS NULL OR ca.created_at <= p_range_end)
      AND ca.sdr_user_id IN (SELECT user_id FROM closer_users)
    UNION ALL
    SELECT se.user_id, se.lead_id
    FROM sent_emails se
    WHERE se.lead_id IS NOT NULL
      AND (p_range_start IS NULL OR se.created_at >= p_range_start)
      AND (p_range_end IS NULL OR se.created_at <= p_range_end)
      AND se.user_id IN (SELECT user_id FROM closer_users)
    UNION ALL
    SELECT al.user_id, al.lead_id
    FROM lead_activity_logs al
    WHERE al.action_type IN ('status_changed', 'opportunity_created')
      AND al.lead_id IS NOT NULL
      AND (p_range_start IS NULL OR al.created_at >= p_range_start)
      AND (p_range_end IS NULL OR al.created_at <= p_range_end)
      AND al.user_id IN (SELECT user_id FROM closer_users)
    UNION ALL
    SELECT o.assigned_to_user_id, o.lead_id
    FROM opportunities o
    WHERE o.returned_to_sdr = false AND o.meeting_datetime IS NOT NULL AND o.lead_id IS NOT NULL
      AND (p_range_start IS NULL OR o.meeting_datetime >= p_range_start)
      AND (p_range_end IS NULL OR o.meeting_datetime <= p_range_end)
      AND o.assigned_to_user_id IN (SELECT user_id FROM closer_users)
    UNION ALL
    SELECT p.created_by_user_id, o.lead_id
    FROM proposals p
    JOIN opportunities o ON o.id = p.opportunity_id AND o.returned_to_sdr = false
    WHERE o.lead_id IS NOT NULL
      AND (p_range_start IS NULL OR p.created_at >= p_range_start)
      AND (p_range_end IS NULL OR p.created_at <= p_range_end)
      AND p.created_by_user_id IN (SELECT user_id FROM closer_users)
  ),
  touched_counts AS (
    SELECT cid, count(DISTINCT lead_id) AS leads_touched
    FROM all_touched
    WHERE lead_id IS NOT NULL
    GROUP BY cid
  ),
  note_counts AS (
    SELECT n.user_id AS cid, count(*) AS cnt
    FROM lead_notes n
    WHERE (p_range_start IS NULL OR n.created_at >= p_range_start)
      AND (p_range_end IS NULL OR n.created_at <= p_range_end)
      AND n.user_id IN (SELECT user_id FROM closer_users)
    GROUP BY n.user_id
  ),
  call_counts AS (
    SELECT ca.sdr_user_id AS cid, count(*) AS cnt
    FROM call_analyses ca
    WHERE ca.status = 'completed'
      AND (p_range_start IS NULL OR ca.created_at >= p_range_start)
      AND (p_range_end IS NULL OR ca.created_at <= p_range_end)
      AND ca.sdr_user_id IN (SELECT user_id FROM closer_users)
    GROUP BY ca.sdr_user_id
  ),
  email_counts AS (
    SELECT se.user_id AS cid, count(*) AS cnt
    FROM sent_emails se
    WHERE (p_range_start IS NULL OR se.created_at >= p_range_start)
      AND (p_range_end IS NULL OR se.created_at <= p_range_end)
      AND se.user_id IN (SELECT user_id FROM closer_users)
    GROUP BY se.user_id
  ),
  stage_change_counts AS (
    SELECT al.user_id AS cid, count(*) AS cnt
    FROM lead_activity_logs al
    WHERE al.action_type IN ('status_changed', 'opportunity_created')
      AND (p_range_start IS NULL OR al.created_at >= p_range_start)
      AND (p_range_end IS NULL OR al.created_at <= p_range_end)
      AND al.user_id IN (SELECT user_id FROM closer_users)
    GROUP BY al.user_id
  ),
  meeting_counts AS (
    SELECT o.assigned_to_user_id AS cid, count(*) AS cnt
    FROM opportunities o
    WHERE o.returned_to_sdr = false AND o.meeting_datetime IS NOT NULL
      AND (p_range_start IS NULL OR o.meeting_datetime >= p_range_start)
      AND (p_range_end IS NULL OR o.meeting_datetime <= p_range_end)
      AND o.assigned_to_user_id IN (SELECT user_id FROM closer_users)
    GROUP BY o.assigned_to_user_id
  ),
  proposal_counts AS (
    SELECT p.created_by_user_id AS cid, count(*) AS cnt
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
    COALESCE(tc.leads_touched, 0) AS opportunities_worked,
    (COALESCE(nc.cnt,0) + COALESCE(cc.cnt,0) + COALESCE(ec.cnt,0) + COALESCE(sc.cnt,0) + COALESCE(mc.cnt,0) + COALESCE(pc.cnt,0))::bigint AS activities,
    COALESCE(cc.cnt, 0) AS calls,
    COALESCE(ec.cnt, 0) AS emails,
    COALESCE(sc.cnt, 0) AS stage_changes,
    COALESCE(mc.cnt, 0) AS meetings,
    COALESCE(pc.cnt, 0) AS proposals
  FROM closer_users cu
  LEFT JOIN touched_counts tc ON tc.cid = cu.user_id
  LEFT JOIN note_counts nc ON nc.cid = cu.user_id
  LEFT JOIN call_counts cc ON cc.cid = cu.user_id
  LEFT JOIN email_counts ec ON ec.cid = cu.user_id
  LEFT JOIN stage_change_counts sc ON sc.cid = cu.user_id
  LEFT JOIN meeting_counts mc ON mc.cid = cu.user_id
  LEFT JOIN proposal_counts pc ON pc.cid = cu.user_id
  WHERE COALESCE(nc.cnt,0) + COALESCE(cc.cnt,0) + COALESCE(ec.cnt,0) + COALESCE(sc.cnt,0) + COALESCE(mc.cnt,0) + COALESCE(pc.cnt,0) > 0
  ORDER BY (COALESCE(nc.cnt,0) + COALESCE(cc.cnt,0) + COALESCE(ec.cnt,0) + COALESCE(sc.cnt,0) + COALESCE(mc.cnt,0) + COALESCE(pc.cnt,0)) DESC;
END;
$function$;

-- Update get_closer_activity_metrics: opportunities_worked counts distinct leads from ALL sources
CREATE OR REPLACE FUNCTION public.get_closer_activity_metrics(
  p_closer_id uuid DEFAULT NULL,
  p_range_start timestamptz DEFAULT NULL,
  p_range_end timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_result json;
  v_activities_by_type jsonb;
  v_notes bigint; v_calls bigint; v_emails bigint; v_stage_changes bigint;
  v_meetings bigint; v_proposals_total bigint; v_proposals_new bigint; v_proposals_evolution bigint;
  v_opps_worked bigint;
BEGIN
  SELECT count(*) INTO v_notes
  FROM lead_notes n
  WHERE (p_closer_id IS NULL OR n.user_id = p_closer_id)
    AND (p_range_start IS NULL OR n.created_at >= p_range_start)
    AND (p_range_end IS NULL OR n.created_at <= p_range_end);

  -- Count distinct leads touched across ALL sources
  SELECT count(DISTINCT lead_id) INTO v_opps_worked
  FROM (
    SELECT n.lead_id FROM lead_notes n
    WHERE (p_closer_id IS NULL OR n.user_id = p_closer_id)
      AND (p_range_start IS NULL OR n.created_at >= p_range_start)
      AND (p_range_end IS NULL OR n.created_at <= p_range_end)
      AND n.lead_id IS NOT NULL
    UNION ALL
    SELECT ca.lead_id FROM call_analyses ca
    WHERE ca.status = 'completed'
      AND (p_closer_id IS NULL OR ca.sdr_user_id = p_closer_id)
      AND (p_range_start IS NULL OR ca.created_at >= p_range_start)
      AND (p_range_end IS NULL OR ca.created_at <= p_range_end)
      AND ca.lead_id IS NOT NULL
    UNION ALL
    SELECT se.lead_id FROM sent_emails se
    WHERE (p_closer_id IS NULL OR se.user_id = p_closer_id)
      AND (p_range_start IS NULL OR se.created_at >= p_range_start)
      AND (p_range_end IS NULL OR se.created_at <= p_range_end)
      AND se.lead_id IS NOT NULL
    UNION ALL
    SELECT al.lead_id FROM lead_activity_logs al
    WHERE al.action_type IN ('status_changed', 'opportunity_created')
      AND (p_closer_id IS NULL OR al.user_id = p_closer_id)
      AND (p_range_start IS NULL OR al.created_at >= p_range_start)
      AND (p_range_end IS NULL OR al.created_at <= p_range_end)
      AND al.lead_id IS NOT NULL
    UNION ALL
    SELECT o.lead_id FROM opportunities o
    WHERE o.returned_to_sdr = false AND o.meeting_datetime IS NOT NULL
      AND (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id)
      AND (p_range_start IS NULL OR o.meeting_datetime >= p_range_start)
      AND (p_range_end IS NULL OR o.meeting_datetime <= p_range_end)
      AND o.lead_id IS NOT NULL
    UNION ALL
    SELECT o.lead_id FROM proposals p
    JOIN opportunities o ON o.id = p.opportunity_id AND o.returned_to_sdr = false
    WHERE (p_closer_id IS NULL OR p.created_by_user_id = p_closer_id)
      AND (p_range_start IS NULL OR p.created_at >= p_range_start)
      AND (p_range_end IS NULL OR p.created_at <= p_range_end)
      AND o.lead_id IS NOT NULL
  ) AS all_touched;

  SELECT count(*) INTO v_calls FROM call_analyses ca
  WHERE ca.status = 'completed'
    AND (p_closer_id IS NULL OR ca.sdr_user_id = p_closer_id)
    AND (p_range_start IS NULL OR ca.created_at >= p_range_start)
    AND (p_range_end IS NULL OR ca.created_at <= p_range_end);

  SELECT count(*) INTO v_emails FROM sent_emails se
  WHERE (p_closer_id IS NULL OR se.user_id = p_closer_id)
    AND (p_range_start IS NULL OR se.created_at >= p_range_start)
    AND (p_range_end IS NULL OR se.created_at <= p_range_end);

  SELECT count(*) INTO v_stage_changes FROM lead_activity_logs al
  WHERE al.action_type IN ('status_changed', 'opportunity_created')
    AND (p_closer_id IS NULL OR al.user_id = p_closer_id)
    AND (p_range_start IS NULL OR al.created_at >= p_range_start)
    AND (p_range_end IS NULL OR al.created_at <= p_range_end);

  SELECT count(*) INTO v_meetings FROM opportunities o
  WHERE o.returned_to_sdr = false AND o.meeting_datetime IS NOT NULL
    AND (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id)
    AND (p_range_start IS NULL OR o.meeting_datetime >= p_range_start)
    AND (p_range_end IS NULL OR o.meeting_datetime <= p_range_end);

  SELECT count(*) INTO v_proposals_total FROM proposals p
  JOIN opportunities o ON o.id = p.opportunity_id AND o.returned_to_sdr = false
  WHERE (p_closer_id IS NULL OR p.created_by_user_id = p_closer_id)
    AND (p_range_start IS NULL OR p.created_at >= p_range_start)
    AND (p_range_end IS NULL OR p.created_at <= p_range_end);

  SELECT count(*) INTO v_proposals_new FROM proposals p
  JOIN opportunities o ON o.id = p.opportunity_id AND o.returned_to_sdr = false
  WHERE (p_closer_id IS NULL OR p.created_by_user_id = p_closer_id)
    AND (p_range_start IS NULL OR p.created_at >= p_range_start)
    AND (p_range_end IS NULL OR p.created_at <= p_range_end)
    AND COALESCE(o.opportunity_type, 'new_business') != 'evolution'
    AND COALESCE(p.product_type, '') != 'evolucao_ez_chat';

  SELECT count(*) INTO v_proposals_evolution FROM proposals p
  JOIN opportunities o ON o.id = p.opportunity_id AND o.returned_to_sdr = false
  WHERE (p_closer_id IS NULL OR p.created_by_user_id = p_closer_id)
    AND (p_range_start IS NULL OR p.created_at >= p_range_start)
    AND (p_range_end IS NULL OR p.created_at <= p_range_end)
    AND (o.opportunity_type = 'evolution' OR p.product_type = 'evolucao_ez_chat');

  v_activities_by_type := jsonb_build_object(
    'Nota', v_notes, 'Ligação', v_calls, 'E-mail', v_emails,
    'Mud. Status', v_stage_changes, 'Reunião', v_meetings, 'Proposta', v_proposals_total
  );

  SELECT json_build_object(
    'opportunities_worked', v_opps_worked,
    'total_activities', (v_notes + v_calls + v_emails + v_stage_changes + v_meetings + v_proposals_total),
    'meetings_held', v_meetings,
    'proposals_total', v_proposals_total,
    'proposals_new', v_proposals_new,
    'proposals_evolution', v_proposals_evolution,
    'activities_by_type', v_activities_by_type
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Update get_closer_breakdown_detail: opportunities_worked now uses all 6 sources
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
    RETURN QUERY
    SELECT o.id, l.id, o.id,
      COALESCE(l.razao_social, l.nome_fantasia, l.company, '—'),
      COALESCE(l.name, '—'),
      COALESCE('R$ ' || TRIM(TO_CHAR(o.deal_value, '999G999G999')), '—'),
      o.won_at
    FROM opportunities o JOIN leads l ON l.id = o.lead_id
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
