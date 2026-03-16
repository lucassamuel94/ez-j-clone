CREATE OR REPLACE FUNCTION public.get_filtered_lead_ids(
  p_tab text DEFAULT 'all',
  p_sdr_id uuid DEFAULT NULL,
  p_search text DEFAULT '',
  p_statuses text[] DEFAULT NULL,
  p_limit integer DEFAULT 10000
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result text[];
  v_now timestamptz := now() AT TIME ZONE 'America/Sao_Paulo';
  v_end_of_today timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') + interval '1 day';
BEGIN
  WITH filtered AS (
    SELECT l.id
    FROM leads l
    WHERE
      CASE
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
      AND (
        p_sdr_id IS NULL
        OR (p_sdr_id = '00000000-0000-0000-0000-000000000000' AND l.owner_user_id IS NULL)
        OR l.owner_user_id = p_sdr_id
      )
      AND (p_statuses IS NULL OR l.status = ANY(p_statuses))
      AND (
        p_search = '' OR p_search IS NULL
        OR l.name ILIKE '%' || p_search || '%'
        OR l.company ILIKE '%' || p_search || '%'
        OR l.email ILIKE '%' || p_search || '%'
        OR l.phone ILIKE '%' || p_search || '%'
        OR l.whatsapp ILIKE '%' || p_search || '%'
        OR l.cnpj ILIKE '%' || p_search || '%'
        OR l.razao_social ILIKE '%' || p_search || '%'
        OR l.nome_fantasia ILIKE '%' || p_search || '%'
      )
    ORDER BY l.next_action_at ASC
    LIMIT p_limit
  )
  SELECT array_agg(filtered.id::text) INTO result FROM filtered;
  
  RETURN COALESCE(result, ARRAY[]::text[]);
END;
$$;