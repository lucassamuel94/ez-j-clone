
CREATE OR REPLACE FUNCTION public.search_leads_by_status(
  p_status text,
  p_sdr_id uuid DEFAULT NULL,
  p_search text DEFAULT '',
  p_sort text DEFAULT 'next_action_asc',
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 15
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_offset int;
  v_total bigint;
  v_result json;
  v_search_norm text;
  v_cnpj_norm text;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  IF p_search IS NOT NULL AND p_search != '' THEN
    v_search_norm := public.immutable_unaccent(lower(trim(p_search)));
    v_cnpj_norm := regexp_replace(trim(p_search), '[^0-9]', '', 'g');
  END IF;

  WITH base AS (
    SELECT l.*, p.name AS owner_name
    FROM leads l
    LEFT JOIN profiles p ON p.id = l.owner_user_id
    WHERE l.status::text = p_status
      AND CASE
        WHEN p_sdr_id IS NULL THEN l.owner_user_id IS NOT NULL
        WHEN p_sdr_id = '00000000-0000-0000-0000-000000000000'::uuid THEN l.owner_user_id IS NULL
        ELSE l.owner_user_id = p_sdr_id
      END
      AND CASE
        WHEN v_search_norm IS NOT NULL THEN (
          public.immutable_unaccent(lower(l.name)) ILIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(l.company)) ILIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(COALESCE(l.razao_social,''))) ILIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(COALESCE(l.nome_fantasia,''))) ILIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(COALESCE(l.email,''))) ILIKE '%' || v_search_norm || '%'
          OR (v_cnpj_norm != '' AND regexp_replace(COALESCE(l.cnpj,''), '[^0-9]', '', 'g') ILIKE '%' || v_cnpj_norm || '%')
          OR COALESCE(l.phone,'') ILIKE '%' || p_search || '%'
          OR COALESCE(l.whatsapp,'') ILIKE '%' || p_search || '%'
          OR public.similarity(public.immutable_unaccent(lower(l.name)), v_search_norm) > 0.25
          OR public.similarity(public.immutable_unaccent(lower(l.company)), v_search_norm) > 0.25
        )
        ELSE true
      END
  ),
  counted AS (
    SELECT count(*) AS total FROM base
  ),
  sorted AS (
    SELECT * FROM base
    ORDER BY
      CASE WHEN p_sort = 'priority_desc' THEN priority_score END DESC NULLS LAST,
      CASE WHEN p_sort = 'created_desc' THEN created_at END DESC,
      CASE WHEN p_sort = 'next_action_asc' THEN next_action_at END ASC NULLS LAST,
      CASE WHEN p_sort = 'temperature_desc' THEN
        CASE temperature
          WHEN 'quente' THEN 3
          WHEN 'morno' THEN 2
          WHEN 'frio' THEN 1
          ELSE 0
        END
      END DESC NULLS LAST,
      CASE WHEN p_sort = 'last_contact_asc' THEN last_contact_at END ASC NULLS LAST,
      next_action_at ASC NULLS LAST
    LIMIT p_page_size OFFSET v_offset
  )
  SELECT json_build_object(
    'total', (SELECT total FROM counted),
    'data', COALESCE((SELECT json_agg(row_to_json(sorted)) FROM sorted), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;
