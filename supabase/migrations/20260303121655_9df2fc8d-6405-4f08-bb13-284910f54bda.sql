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
        WHEN p_tab = 'oportunidades' THEN o.stage NOT IN ('Ganho', 'Perdido', 'Demonstração')
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