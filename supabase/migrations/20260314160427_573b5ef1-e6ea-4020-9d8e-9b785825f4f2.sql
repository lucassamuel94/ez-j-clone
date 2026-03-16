
CREATE OR REPLACE FUNCTION public.search_opportunities_kanban(
  p_stage text,
  p_closer_id uuid DEFAULT NULL,
  p_search text DEFAULT '',
  p_opportunity_type text DEFAULT 'new_business',
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 15,
  p_sort text DEFAULT 'created_desc'
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
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
      AND o.stage = p_stage
      AND CASE
        WHEN p_opportunity_type = 'evolution' THEN o.opportunity_type = 'evolution'
        ELSE (o.opportunity_type IS NULL OR o.opportunity_type = 'new_business')
      END
      AND CASE
        WHEN p_closer_id = v_unassigned_sentinel THEN o.assigned_to_user_id IS NULL
        WHEN p_closer_id IS NOT NULL THEN o.assigned_to_user_id = p_closer_id
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
      CASE WHEN p_sort = 'value_desc' THEN deal_value END DESC NULLS LAST,
      CASE WHEN p_sort = 'created_desc' THEN created_at END DESC,
      CASE WHEN p_sort = 'next_action_asc' THEN lead_next_action_at END ASC NULLS LAST,
      CASE WHEN p_sort = 'temperature_desc' THEN
        CASE lead_temperature WHEN 'quente' THEN 3 WHEN 'morno' THEN 2 WHEN 'frio' THEN 1 ELSE 0 END
      END DESC,
      CASE WHEN p_sort = 'last_contact_asc' THEN lead_last_contact_at END ASC NULLS LAST,
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
