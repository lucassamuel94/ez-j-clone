
-- RPC: search opportunities with server-side pagination, filtering, and search
CREATE OR REPLACE FUNCTION public.search_opportunities_paginated(
  p_tab text DEFAULT 'oportunidades',
  p_closer_id uuid DEFAULT NULL,
  p_search text DEFAULT '',
  p_stages text[] DEFAULT NULL,
  p_meeting_from timestamptz DEFAULT NULL,
  p_meeting_to timestamptz DEFAULT NULL,
  p_won_from timestamptz DEFAULT NULL,
  p_won_to timestamptz DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset int;
  v_total bigint;
  v_result json;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  WITH base AS (
    SELECT
      o.*,
      l.name AS lead_name,
      COALESCE(l.razao_social, l.nome_fantasia, l.company) AS lead_company,
      l.razao_social AS lead_razao_social,
      l.nome_fantasia AS lead_nome_fantasia,
      l.cnpj AS lead_cnpj,
      l.whatsapp AS lead_whatsapp,
      l.phone AS lead_phone,
      l.phone_2 AS lead_phone_2,
      l.phone_3 AS lead_phone_3,
      l.phone_4 AS lead_phone_4,
      l.email AS lead_email,
      l.temperature AS lead_temperature,
      l.last_contact_at AS lead_last_contact_at,
      l.next_action_at AS lead_next_action_at,
      l.status AS lead_status,
      l.website AS lead_website,
      sdr_p.name AS sdr_name,
      closer_p.name AS closer_name
    FROM opportunities o
    LEFT JOIN leads l ON l.id = o.lead_id
    LEFT JOIN profiles sdr_p ON sdr_p.id = o.sdr_user_id
    LEFT JOIN profiles closer_p ON closer_p.id = o.assigned_to_user_id
    WHERE o.returned_to_sdr = false
      -- Closer filter
      AND CASE
        WHEN p_closer_id IS NOT NULL THEN o.assigned_to_user_id = p_closer_id
        ELSE true
      END
      -- Tab-based stage filter
      AND CASE
        WHEN p_stages IS NOT NULL THEN o.stage = ANY(p_stages)
        WHEN p_tab = 'oportunidades' THEN o.stage NOT IN ('Ganho', 'Perdido', 'Demonstração')
        WHEN p_tab = 'reunioes' THEN o.stage = 'Demonstração'
        WHEN p_tab = 'vendas' THEN o.stage = 'Ganho'
        ELSE true
      END
      -- Meeting date range (for reunioes tab)
      AND CASE
        WHEN p_meeting_from IS NOT NULL THEN o.meeting_datetime >= p_meeting_from
        ELSE true
      END
      AND CASE
        WHEN p_meeting_to IS NOT NULL THEN o.meeting_datetime <= p_meeting_to
        ELSE true
      END
      -- Won date range (for vendas tab)
      AND CASE
        WHEN p_won_from IS NOT NULL THEN o.updated_at >= p_won_from
        ELSE true
      END
      AND CASE
        WHEN p_won_to IS NOT NULL THEN o.updated_at <= p_won_to
        ELSE true
      END
      -- Search
      AND CASE
        WHEN p_search != '' THEN (
          l.name ILIKE '%' || p_search || '%'
          OR l.company ILIKE '%' || p_search || '%'
          OR l.razao_social ILIKE '%' || p_search || '%'
          OR l.nome_fantasia ILIKE '%' || p_search || '%'
          OR l.email ILIKE '%' || p_search || '%'
          OR l.cnpj ILIKE '%' || p_search || '%'
          OR l.phone ILIKE '%' || p_search || '%'
          OR l.whatsapp ILIKE '%' || p_search || '%'
          OR sdr_p.name ILIKE '%' || p_search || '%'
          OR closer_p.name ILIKE '%' || p_search || '%'
        )
        ELSE true
      END
  ),
  counted AS (
    SELECT count(*) AS total FROM base
  ),
  paged AS (
    SELECT * FROM base
    ORDER BY
      CASE WHEN stage IN ('Ganho', 'Perdido') THEN 1 ELSE 0 END,
      CASE WHEN lead_next_action_at < now() AND stage NOT IN ('Ganho', 'Perdido') THEN 0 ELSE 1 END,
      COALESCE(deal_value, 0) DESC,
      created_at DESC
    LIMIT p_page_size OFFSET v_offset
  )
  SELECT json_build_object(
    'total', (SELECT total FROM counted),
    'data', COALESCE((SELECT json_agg(row_to_json(paged)) FROM paged), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- RPC: get tab counts for closer pipeline
CREATE OR REPLACE FUNCTION public.get_opportunity_tab_counts(
  p_closer_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'oportunidades', (
      SELECT count(*) FROM opportunities
      WHERE returned_to_sdr = false
        AND stage NOT IN ('Ganho', 'Perdido', 'Demonstração')
        AND CASE WHEN p_closer_id IS NOT NULL THEN assigned_to_user_id = p_closer_id ELSE true END
    ),
    'reunioes', (
      SELECT count(*) FROM opportunities
      WHERE returned_to_sdr = false
        AND stage = 'Demonstração'
        AND CASE WHEN p_closer_id IS NOT NULL THEN assigned_to_user_id = p_closer_id ELSE true END
    ),
    'vendas', (
      SELECT count(*) FROM opportunities
      WHERE returned_to_sdr = false
        AND stage = 'Ganho'
        AND CASE WHEN p_closer_id IS NOT NULL THEN assigned_to_user_id = p_closer_id ELSE true END
    ),
    'total_active', (
      SELECT count(*) FROM opportunities
      WHERE returned_to_sdr = false
        AND stage NOT IN ('Ganho', 'Perdido')
        AND CASE WHEN p_closer_id IS NOT NULL THEN assigned_to_user_id = p_closer_id ELSE true END
    ),
    'total_won', (
      SELECT count(*) FROM opportunities
      WHERE returned_to_sdr = false
        AND stage = 'Ganho'
        AND CASE WHEN p_closer_id IS NOT NULL THEN assigned_to_user_id = p_closer_id ELSE true END
    ),
    'total_lost', (
      SELECT count(*) FROM opportunities
      WHERE returned_to_sdr = false
        AND stage = 'Perdido'
        AND CASE WHEN p_closer_id IS NOT NULL THEN assigned_to_user_id = p_closer_id ELSE true END
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
