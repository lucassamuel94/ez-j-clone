
DROP FUNCTION IF EXISTS public.search_leads_paginated(text, uuid, text, text[], int, int);
DROP FUNCTION IF EXISTS public.get_lead_tab_counts(uuid);

CREATE FUNCTION public.search_leads_paginated(
  p_tab text,
  p_sdr_id uuid DEFAULT NULL,
  p_search text DEFAULT '',
  p_statuses text[] DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 50
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset int;
  v_now timestamptz := now();
  v_end_of_today timestamptz;
  v_total bigint;
  v_result json;
BEGIN
  v_offset := (p_page - 1) * p_page_size;
  v_end_of_today := date_trunc('day', v_now AT TIME ZONE 'America/Sao_Paulo') + interval '1 day' - interval '1 second';
  v_end_of_today := v_end_of_today AT TIME ZONE 'America/Sao_Paulo';

  WITH base AS (
    SELECT l.*, p.name AS owner_name
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
          l.name ILIKE '%' || p_search || '%'
          OR l.company ILIKE '%' || p_search || '%'
          OR l.razao_social ILIKE '%' || p_search || '%'
          OR l.nome_fantasia ILIKE '%' || p_search || '%'
          OR l.email ILIKE '%' || p_search || '%'
          OR l.cnpj ILIKE '%' || p_search || '%'
          OR l.phone ILIKE '%' || p_search || '%'
          OR l.whatsapp ILIKE '%' || p_search || '%'
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
      CASE WHEN status = 'Descartado' THEN 1 ELSE 0 END,
      next_action_at ASC
    LIMIT p_page_size OFFSET v_offset
  )
  SELECT json_build_object(
    'total', (SELECT total FROM counted),
    'data', COALESCE((SELECT json_agg(row_to_json(paged)) FROM paged), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE FUNCTION public.get_lead_tab_counts(p_sdr_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    'total', (SELECT count(*) FROM filtered WHERE status != 'Descartado'),
    'overdue', (SELECT count(*) FROM filtered WHERE next_action_at < v_now AND status != 'Descartado'),
    'today', (SELECT count(*) FROM filtered WHERE next_action_at >= v_now AND next_action_at <= v_end_of_today AND status != 'Descartado'),
    'new', (SELECT count(*) FROM filtered WHERE status = 'Novo'),
    'in_contact_return', (SELECT count(*) FROM filtered WHERE status = 'Em contato'),
    'devolvido_closer', (SELECT count(*) FROM filtered WHERE status = 'Devolvido pelo Closer'),
    'ocupado', (SELECT count(*) FROM filtered WHERE status = 'Ocupado'),
    'nao_atendeu', (SELECT count(*) FROM filtered WHERE status = 'Não atendeu'),
    'sem_retorno', (SELECT count(*) FROM filtered WHERE status = 'Sem retorno'),
    'agendar_retorno', (SELECT count(*) FROM filtered WHERE status = 'Agendar retorno'),
    'scheduled', (SELECT count(*) FROM filtered WHERE status = 'Reunião agendada'),
    'confirmed', (SELECT count(*) FROM filtered WHERE status = 'Oportunidade criada'),
    'future_opportunity', (SELECT count(*) FROM filtered WHERE status IN ('Reciclagem', 'Interesse/Agendar Retorno')),
    'discarded', (SELECT count(*) FROM filtered WHERE status = 'Descartado')
  ) INTO v_result;

  RETURN v_result;
END;
$$;
