
-- Update search_opportunities_paginated: include Demonstração in oportunidades tab
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
  v_search_norm text;
  v_unassigned_sentinel uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  IF p_search != '' THEN
    v_search_norm := public.immutable_unaccent(lower(trim(p_search)));
  END IF;

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
      AND CASE
        WHEN p_closer_id = v_unassigned_sentinel THEN o.assigned_to_user_id IS NULL
        WHEN p_closer_id IS NOT NULL THEN o.assigned_to_user_id = p_closer_id
        ELSE true
      END
      AND CASE
        WHEN p_stages IS NOT NULL THEN o.stage = ANY(p_stages)
        WHEN p_tab = 'oportunidades' THEN o.stage NOT IN ('Ganho', 'Perdido')
        WHEN p_tab = 'reunioes' THEN o.stage = 'Demonstração'
        WHEN p_tab = 'vendas' THEN o.stage = 'Ganho'
        ELSE true
      END
      AND CASE
        WHEN p_meeting_from IS NOT NULL AND p_meeting_to IS NOT NULL THEN o.meeting_datetime BETWEEN p_meeting_from AND p_meeting_to
        WHEN p_meeting_from IS NOT NULL THEN o.meeting_datetime >= p_meeting_from
        WHEN p_meeting_to IS NOT NULL THEN o.meeting_datetime <= p_meeting_to
        ELSE true
      END
      AND CASE
        WHEN p_won_from IS NOT NULL AND p_won_to IS NOT NULL AND p_tab = 'vendas' THEN o.updated_at BETWEEN p_won_from AND p_won_to
        WHEN p_won_from IS NOT NULL AND p_tab = 'vendas' THEN o.updated_at >= p_won_from
        WHEN p_won_to IS NOT NULL AND p_tab = 'vendas' THEN o.updated_at <= p_won_to
        ELSE true
      END
      AND CASE
        WHEN v_search_norm IS NOT NULL THEN (
          public.immutable_unaccent(lower(COALESCE(l.name, ''))) LIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(COALESCE(l.razao_social, ''))) LIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(COALESCE(l.nome_fantasia, ''))) LIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(COALESCE(l.company, ''))) LIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(COALESCE(l.email, ''))) LIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(COALESCE(sdr_p.name, ''))) LIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(COALESCE(closer_p.name, ''))) LIKE '%' || v_search_norm || '%'
          OR replace(replace(replace(COALESCE(l.cnpj, ''), '.', ''), '-', ''), '/', '') LIKE '%' || replace(replace(replace(v_search_norm, '.', ''), '-', ''), '/', '') || '%'
          OR replace(replace(COALESCE(l.whatsapp, ''), '-', ''), ' ', '') LIKE '%' || replace(replace(v_search_norm, '-', ''), ' ', '') || '%'
          OR replace(replace(COALESCE(l.phone, ''), '-', ''), ' ', '') LIKE '%' || replace(replace(v_search_norm, '-', ''), ' ', '') || '%'
        )
        ELSE true
      END
  ),
  total_count AS (
    SELECT count(*) AS cnt FROM base
  ),
  paginated AS (
    SELECT * FROM base
    ORDER BY
      CASE WHEN p_tab = 'reunioes' THEN meeting_datetime END ASC NULLS LAST,
      CASE WHEN p_tab = 'vendas' THEN updated_at END DESC,
      created_at DESC
    LIMIT p_page_size OFFSET v_offset
  )
  SELECT json_build_object(
    'total', (SELECT cnt FROM total_count),
    'data', COALESCE((SELECT json_agg(row_to_json(p)) FROM paginated p), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Update get_opportunity_tab_counts: include Demonstração in oportunidades count
CREATE OR REPLACE FUNCTION public.get_opportunity_tab_counts(p_closer_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_unassigned_sentinel uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  SELECT json_build_object(
    'oportunidades', (
      SELECT count(*) FROM opportunities
      WHERE returned_to_sdr = false
        AND stage NOT IN ('Ganho', 'Perdido')
        AND CASE 
          WHEN p_closer_id = v_unassigned_sentinel THEN assigned_to_user_id IS NULL
          WHEN p_closer_id IS NOT NULL THEN assigned_to_user_id = p_closer_id 
          ELSE true 
        END
    ),
    'reunioes', (
      SELECT count(*) FROM opportunities
      WHERE returned_to_sdr = false
        AND stage = 'Demonstração'
        AND CASE 
          WHEN p_closer_id = v_unassigned_sentinel THEN assigned_to_user_id IS NULL
          WHEN p_closer_id IS NOT NULL THEN assigned_to_user_id = p_closer_id 
          ELSE true 
        END
    ),
    'vendas', (
      SELECT count(*) FROM opportunities
      WHERE returned_to_sdr = false
        AND stage = 'Ganho'
        AND CASE 
          WHEN p_closer_id = v_unassigned_sentinel THEN assigned_to_user_id IS NULL
          WHEN p_closer_id IS NOT NULL THEN assigned_to_user_id = p_closer_id 
          ELSE true 
        END
    ),
    'total_active', (
      SELECT count(*) FROM opportunities
      WHERE returned_to_sdr = false
        AND stage NOT IN ('Ganho', 'Perdido')
        AND CASE 
          WHEN p_closer_id = v_unassigned_sentinel THEN assigned_to_user_id IS NULL
          WHEN p_closer_id IS NOT NULL THEN assigned_to_user_id = p_closer_id 
          ELSE true 
        END
    ),
    'total_won', (
      SELECT count(*) FROM opportunities
      WHERE returned_to_sdr = false
        AND stage = 'Ganho'
        AND CASE 
          WHEN p_closer_id = v_unassigned_sentinel THEN assigned_to_user_id IS NULL
          WHEN p_closer_id IS NOT NULL THEN assigned_to_user_id = p_closer_id 
          ELSE true 
        END
    ),
    'total_lost', (
      SELECT count(*) FROM opportunities
      WHERE returned_to_sdr = false
        AND stage = 'Perdido'
        AND CASE 
          WHEN p_closer_id = v_unassigned_sentinel THEN assigned_to_user_id IS NULL
          WHEN p_closer_id IS NOT NULL THEN assigned_to_user_id = p_closer_id 
          ELSE true 
        END
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Update get_filtered_opportunity_ids: include Demonstração in oportunidades tab
CREATE OR REPLACE FUNCTION public.get_filtered_opportunity_ids(
  p_tab text DEFAULT 'oportunidades',
  p_closer_id uuid DEFAULT NULL,
  p_search text DEFAULT '',
  p_stages text[] DEFAULT NULL,
  p_meeting_from timestamptz DEFAULT NULL,
  p_meeting_to timestamptz DEFAULT NULL,
  p_won_from timestamptz DEFAULT NULL,
  p_won_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 10000
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result text[];
  v_search_norm text;
  v_cnpj_norm text;
BEGIN
  IF p_search != '' THEN
    v_search_norm := public.immutable_unaccent(lower(trim(p_search)));
    v_cnpj_norm := regexp_replace(trim(p_search), '[^0-9]', '', 'g');
  END IF;

  WITH filtered AS (
    SELECT o.id
    FROM opportunities o
    LEFT JOIN leads l ON l.id = o.lead_id
    LEFT JOIN profiles sdr_p ON sdr_p.id = o.sdr_user_id
    LEFT JOIN profiles closer_p ON closer_p.id = o.assigned_to_user_id
    WHERE o.returned_to_sdr = false
      AND CASE
        WHEN p_closer_id IS NULL THEN true
        WHEN p_closer_id = '00000000-0000-0000-0000-000000000000'::uuid THEN o.assigned_to_user_id IS NULL
        ELSE o.assigned_to_user_id = p_closer_id
      END
      AND CASE
        WHEN p_stages IS NOT NULL THEN o.stage = ANY(p_stages)
        WHEN p_tab = 'oportunidades' THEN o.stage NOT IN ('Ganho', 'Perdido')
        WHEN p_tab = 'reunioes' THEN o.stage = 'Demonstração'
        WHEN p_tab = 'vendas' THEN o.stage = 'Ganho'
        ELSE true
      END
      AND CASE
        WHEN p_meeting_from IS NOT NULL THEN o.meeting_datetime >= p_meeting_from
        ELSE true
      END
      AND CASE
        WHEN p_meeting_to IS NOT NULL THEN o.meeting_datetime <= p_meeting_to
        ELSE true
      END
      AND CASE
        WHEN p_won_from IS NOT NULL THEN o.updated_at >= p_won_from
        ELSE true
      END
      AND CASE
        WHEN p_won_to IS NOT NULL THEN o.updated_at <= p_won_to
        ELSE true
      END
      AND CASE
        WHEN p_search != '' THEN (
          public.immutable_unaccent(lower(l.name)) ILIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(l.company)) ILIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(COALESCE(l.razao_social,''))) ILIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(COALESCE(l.nome_fantasia,''))) ILIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(COALESCE(l.email,''))) ILIKE '%' || v_search_norm || '%'
          OR (v_cnpj_norm != '' AND regexp_replace(COALESCE(l.cnpj,''), '[^0-9]', '', 'g') ILIKE '%' || v_cnpj_norm || '%')
          OR COALESCE(l.phone,'') ILIKE '%' || p_search || '%'
          OR COALESCE(l.whatsapp,'') ILIKE '%' || p_search || '%'
          OR public.immutable_unaccent(lower(COALESCE(sdr_p.name,''))) ILIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(COALESCE(closer_p.name,''))) ILIKE '%' || v_search_norm || '%'
          OR public.similarity(public.immutable_unaccent(lower(l.name)), v_search_norm) > 0.25
          OR public.similarity(public.immutable_unaccent(lower(l.company)), v_search_norm) > 0.25
          OR public.similarity(public.immutable_unaccent(lower(COALESCE(l.razao_social,''))), v_search_norm) > 0.25
          OR public.similarity(public.immutable_unaccent(lower(COALESCE(l.nome_fantasia,''))), v_search_norm) > 0.25
        )
        ELSE true
      END
    ORDER BY o.created_at DESC
    LIMIT p_limit
  )
  SELECT array_agg(filtered.id::text) INTO result FROM filtered;

  RETURN COALESCE(result, ARRAY[]::text[]);
END;
$$;
