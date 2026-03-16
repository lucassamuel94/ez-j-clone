-- 1. Recreate get_lead_tab_counts with case-insensitive matching + new statuses
CREATE OR REPLACE FUNCTION public.get_lead_tab_counts(p_sdr_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_now timestamptz := now();
  v_end_of_today timestamptz;
  v_result json;
BEGIN
  v_end_of_today := date_trunc('day', v_now AT TIME ZONE 'America/Sao_Paulo') + interval '1 day' - interval '1 second';
  v_end_of_today := v_end_of_today AT TIME ZONE 'America/Sao_Paulo';

  WITH filtered AS (
    SELECT status, next_action_at, lead_type, created_at
    FROM leads
    WHERE
      CASE
        WHEN p_sdr_id IS NULL THEN owner_user_id IS NOT NULL
        WHEN p_sdr_id = '00000000-0000-0000-0000-000000000000'::uuid THEN owner_user_id IS NULL
        ELSE owner_user_id = p_sdr_id
      END
  )
  SELECT json_build_object(
    'total', (SELECT count(*) FROM filtered WHERE lower(status::text) != 'descartado'),
    'overdue', (SELECT count(*) FROM filtered WHERE next_action_at < v_now AND lower(status::text) != 'descartado'),
    'today', (SELECT count(*) FROM filtered WHERE next_action_at >= v_now AND next_action_at <= v_end_of_today AND lower(status::text) != 'descartado'),
    'new', (SELECT count(*) FROM filtered WHERE lower(status::text) = 'novo'),
    'in_contact_return', (SELECT count(*) FROM filtered WHERE lower(status::text) IN ('em contato', 'lead quente')),
    'devolvido_closer', (SELECT count(*) FROM filtered WHERE lower(status::text) = 'devolvido pelo closer'),
    'ocupado', (SELECT count(*) FROM filtered WHERE lower(status::text) = 'ocupado'),
    'nao_atendeu', (SELECT count(*) FROM filtered WHERE lower(status::text) = 'não atendeu'),
    'sem_retorno', (SELECT count(*) FROM filtered WHERE lower(status::text) = 'sem retorno'),
    'agendar_retorno', (SELECT count(*) FROM filtered WHERE lower(status::text) = 'agendar retorno'),
    'scheduled', (SELECT count(*) FROM filtered WHERE lower(status::text) IN ('reunião agendada', 'reunião confirmada')),
    'confirmed', (SELECT count(*) FROM filtered WHERE lower(status::text) = 'oportunidade criada'),
    'future_opportunity', (SELECT count(*) FROM filtered WHERE lower(status::text) IN ('reciclagem', 'interesse/agendar retorno', 'oportunidade futura')),
    'discarded', (SELECT count(*) FROM filtered WHERE lower(status::text) = 'descartado')
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- 2. Recreate search_leads_paginated with case-insensitive tab filtering
CREATE OR REPLACE FUNCTION public.search_leads_paginated(p_tab text, p_sdr_id uuid DEFAULT NULL::uuid, p_search text DEFAULT ''::text, p_statuses text[] DEFAULT NULL::text[], p_page integer DEFAULT 1, p_page_size integer DEFAULT 50)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_offset int;
  v_now timestamptz := now();
  v_end_of_today timestamptz;
  v_total bigint;
  v_result json;
  v_search_norm text;
  v_cnpj_norm text;
BEGIN
  v_offset := (p_page - 1) * p_page_size;
  v_end_of_today := date_trunc('day', v_now AT TIME ZONE 'America/Sao_Paulo') + interval '1 day' - interval '1 second';
  v_end_of_today := v_end_of_today AT TIME ZONE 'America/Sao_Paulo';

  IF p_search != '' THEN
    v_search_norm := public.immutable_unaccent(lower(trim(p_search)));
    v_cnpj_norm := regexp_replace(trim(p_search), '[^0-9]', '', 'g');
  END IF;

  WITH base AS (
    SELECT l.*, p.name AS owner_name,
      CASE WHEN p_search != '' THEN
        CASE WHEN
          public.immutable_unaccent(lower(l.name)) ILIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(l.company)) ILIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(COALESCE(l.razao_social,''))) ILIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(COALESCE(l.nome_fantasia,''))) ILIKE '%' || v_search_norm || '%'
          OR public.immutable_unaccent(lower(COALESCE(l.email,''))) ILIKE '%' || v_search_norm || '%'
          OR (v_cnpj_norm != '' AND regexp_replace(COALESCE(l.cnpj,''), '[^0-9]', '', 'g') ILIKE '%' || v_cnpj_norm || '%')
          OR COALESCE(l.phone,'') ILIKE '%' || p_search || '%'
          OR COALESCE(l.whatsapp,'') ILIKE '%' || p_search || '%'
        THEN 1 ELSE 0 END
      ELSE 0 END AS is_exact_match,
      CASE WHEN p_search != '' THEN
        GREATEST(
          public.similarity(public.immutable_unaccent(lower(l.name)), v_search_norm),
          public.similarity(public.immutable_unaccent(lower(l.company)), v_search_norm),
          public.similarity(public.immutable_unaccent(lower(COALESCE(l.razao_social,''))), v_search_norm),
          public.similarity(public.immutable_unaccent(lower(COALESCE(l.nome_fantasia,''))), v_search_norm)
        )
      ELSE 0 END AS sim_score
    FROM leads l
    LEFT JOIN profiles p ON p.id = l.owner_user_id
    WHERE
      CASE
        WHEN p_sdr_id IS NULL THEN l.owner_user_id IS NOT NULL
        WHEN p_sdr_id = '00000000-0000-0000-0000-000000000000'::uuid THEN l.owner_user_id IS NULL
        ELSE l.owner_user_id = p_sdr_id
      END
      AND CASE
        WHEN p_search != '' OR p_statuses IS NOT NULL THEN true
        WHEN p_tab = 'today' THEN l.next_action_at <= v_end_of_today AND lower(l.status::text) != 'descartado'
        WHEN p_tab = 'overdue' THEN l.next_action_at < v_now AND lower(l.status::text) != 'descartado'
        WHEN p_tab = 'in_contact_return' THEN lower(l.status::text) IN ('em contato', 'lead quente')
        WHEN p_tab = 'new' THEN lower(l.status::text) = 'novo'
        WHEN p_tab = 'devolvido_closer' THEN lower(l.status::text) = 'devolvido pelo closer'
        WHEN p_tab = 'ocupado' THEN lower(l.status::text) = 'ocupado'
        WHEN p_tab = 'nao_atendeu' THEN lower(l.status::text) = 'não atendeu'
        WHEN p_tab = 'sem_retorno' THEN lower(l.status::text) = 'sem retorno'
        WHEN p_tab = 'agendar_retorno' THEN lower(l.status::text) = 'agendar retorno'
        WHEN p_tab = 'scheduled' THEN lower(l.status::text) IN ('reunião agendada', 'reunião confirmada')
        WHEN p_tab = 'confirmed' THEN lower(l.status::text) = 'oportunidade criada'
        WHEN p_tab = 'future_opportunity' THEN lower(l.status::text) IN ('reciclagem', 'interesse/agendar retorno', 'oportunidade futura')
        WHEN p_tab = 'discarded' THEN lower(l.status::text) = 'descartado'
        WHEN p_tab = 'all' THEN lower(l.status::text) != 'descartado'
        ELSE lower(l.status::text) != 'descartado'
      END
      AND CASE
        WHEN p_statuses IS NOT NULL THEN l.status::text = ANY(p_statuses)
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
          OR public.similarity(public.immutable_unaccent(lower(l.name)), v_search_norm) > 0.25
          OR public.similarity(public.immutable_unaccent(lower(l.company)), v_search_norm) > 0.25
          OR public.similarity(public.immutable_unaccent(lower(COALESCE(l.razao_social,''))), v_search_norm) > 0.25
          OR public.similarity(public.immutable_unaccent(lower(COALESCE(l.nome_fantasia,''))), v_search_norm) > 0.25
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
      CASE WHEN p_search != '' THEN is_exact_match END DESC NULLS LAST,
      CASE WHEN p_search != '' THEN sim_score END DESC NULLS LAST,
      CASE WHEN p_search = '' THEN (CASE WHEN lower(status::text) = 'descartado' THEN 1 ELSE 0 END) END,
      CASE WHEN p_search = '' THEN next_action_at END ASC
    LIMIT p_page_size OFFSET v_offset
  )
  SELECT json_build_object(
    'total', (SELECT total FROM counted),
    'data', COALESCE((SELECT json_agg(row_to_json(paged)) FROM paged), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- 3. Recreate get_filtered_lead_ids with case-insensitive tab filtering
CREATE OR REPLACE FUNCTION public.get_filtered_lead_ids(p_tab text DEFAULT 'all'::text, p_sdr_id uuid DEFAULT NULL::uuid, p_search text DEFAULT ''::text, p_statuses text[] DEFAULT NULL::text[], p_limit integer DEFAULT 10000)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result text[];
  v_now timestamptz := now();
  v_end_of_today timestamptz;
  v_search_norm text;
  v_cnpj_norm text;
BEGIN
  v_end_of_today := date_trunc('day', v_now AT TIME ZONE 'America/Sao_Paulo') + interval '1 day' - interval '1 second';
  v_end_of_today := v_end_of_today AT TIME ZONE 'America/Sao_Paulo';

  IF p_search IS NOT NULL AND p_search != '' THEN
    v_search_norm := public.immutable_unaccent(lower(trim(p_search)));
    v_cnpj_norm := regexp_replace(trim(p_search), '[^0-9]', '', 'g');
  END IF;

  WITH filtered AS (
    SELECT l.id
    FROM leads l
    WHERE
      CASE
        WHEN p_sdr_id IS NULL THEN l.owner_user_id IS NOT NULL
        WHEN p_sdr_id = '00000000-0000-0000-0000-000000000000'::uuid THEN l.owner_user_id IS NULL
        ELSE l.owner_user_id = p_sdr_id
      END
      AND CASE
        WHEN p_search != '' OR p_statuses IS NOT NULL THEN true
        WHEN p_tab = 'today' THEN l.next_action_at <= v_end_of_today AND lower(l.status::text) != 'descartado'
        WHEN p_tab = 'overdue' THEN l.next_action_at < v_now AND lower(l.status::text) != 'descartado'
        WHEN p_tab = 'in_contact_return' THEN lower(l.status::text) IN ('em contato', 'lead quente')
        WHEN p_tab = 'new' THEN lower(l.status::text) = 'novo'
        WHEN p_tab = 'devolvido_closer' THEN lower(l.status::text) = 'devolvido pelo closer'
        WHEN p_tab = 'ocupado' THEN lower(l.status::text) = 'ocupado'
        WHEN p_tab = 'nao_atendeu' THEN lower(l.status::text) = 'não atendeu'
        WHEN p_tab = 'sem_retorno' THEN lower(l.status::text) = 'sem retorno'
        WHEN p_tab = 'agendar_retorno' THEN lower(l.status::text) = 'agendar retorno'
        WHEN p_tab = 'scheduled' THEN lower(l.status::text) IN ('reunião agendada', 'reunião confirmada')
        WHEN p_tab = 'confirmed' THEN lower(l.status::text) = 'oportunidade criada'
        WHEN p_tab = 'future_opportunity' THEN lower(l.status::text) IN ('reciclagem', 'interesse/agendar retorno', 'oportunidade futura')
        WHEN p_tab = 'discarded' THEN lower(l.status::text) = 'descartado'
        WHEN p_tab = 'all' THEN lower(l.status::text) != 'descartado'
        ELSE lower(l.status::text) != 'descartado'
      END
      AND CASE
        WHEN p_statuses IS NOT NULL THEN l.status::text = ANY(p_statuses)
        ELSE true
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
          OR public.similarity(public.immutable_unaccent(lower(COALESCE(l.razao_social,''))), v_search_norm) > 0.25
          OR public.similarity(public.immutable_unaccent(lower(COALESCE(l.nome_fantasia,''))), v_search_norm) > 0.25
        )
        ELSE true
      END
    ORDER BY l.next_action_at ASC
    LIMIT p_limit
  )
  SELECT array_agg(filtered.id::text) INTO result FROM filtered;

  RETURN COALESCE(result, ARRAY[]::text[]);
END;
$function$;
