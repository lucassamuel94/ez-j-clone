
CREATE OR REPLACE FUNCTION public.get_filtered_lead_ids(
  p_tab text DEFAULT 'all'::text,
  p_sdr_id uuid DEFAULT NULL::uuid,
  p_search text DEFAULT ''::text,
  p_statuses text[] DEFAULT NULL::text[],
  p_limit integer DEFAULT 10000
)
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
      -- SDR filter: mirrors search_leads_paginated exactly
      CASE
        WHEN p_sdr_id IS NULL THEN l.owner_user_id IS NOT NULL
        WHEN p_sdr_id = '00000000-0000-0000-0000-000000000000'::uuid THEN l.owner_user_id IS NULL
        ELSE l.owner_user_id = p_sdr_id
      END
      -- Tab filter (only when no search and no status filter)
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
      -- Status filter with correct cast
      AND CASE
        WHEN p_statuses IS NOT NULL THEN l.status::text = ANY(p_statuses)
        ELSE true
      END
      -- Search filter: mirrors search_leads_paginated (unaccent + fuzzy)
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
