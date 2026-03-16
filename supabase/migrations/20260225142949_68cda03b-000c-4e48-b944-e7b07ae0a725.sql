
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
        WHEN p_tab = 'today' THEN l.next_action_at <= v_end_of_today AND l.status != 'Descartado'
        WHEN p_tab = 'overdue' THEN l.next_action_at < v_now AND l.status != 'Descartado'
        WHEN p_tab = 'in_contact_return' THEN l.status = 'Em contato'
        WHEN p_tab = 'new' THEN l.status = 'Novo'
        WHEN p_tab = 'devolvido_closer' THEN l.status = 'Devolvido pelo Closer'
        WHEN p_tab = 'ocupado' THEN l.status = 'Ocupado'
        WHEN p_tab = 'nao_atendeu' THEN l.status = 'Não atendeu'
        WHEN p_tab = 'sem_retorno' THEN l.status = 'Sem retorno'
        WHEN p_tab = 'agendar_retorno' THEN l.status = 'Agendar retorno'
        WHEN p_tab = 'scheduled' THEN l.status = 'Reunião agendada'
        WHEN p_tab = 'confirmed' THEN l.status = 'Oportunidade criada'
        WHEN p_tab = 'future_opportunity' THEN l.status IN ('Reciclagem', 'Interesse/Agendar Retorno')
        WHEN p_tab = 'discarded' THEN l.status = 'Descartado'
        WHEN p_tab = 'all' THEN l.status != 'Descartado'
        ELSE l.status != 'Descartado'
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
      CASE WHEN p_search = '' THEN (CASE WHEN status = 'Descartado' THEN 1 ELSE 0 END) END,
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

CREATE OR REPLACE FUNCTION public.search_opportunities_paginated(p_tab text DEFAULT 'oportunidades'::text, p_closer_id uuid DEFAULT NULL::uuid, p_search text DEFAULT ''::text, p_stages text[] DEFAULT NULL::text[], p_meeting_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_meeting_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_won_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_won_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50)
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

  IF p_search != '' THEN
    v_search_norm := public.immutable_unaccent(lower(trim(p_search)));
    v_cnpj_norm := regexp_replace(trim(p_search), '[^0-9]', '', 'g');
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
        WHEN p_closer_id IS NOT NULL THEN o.assigned_to_user_id = p_closer_id
        ELSE true
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
$function$;
