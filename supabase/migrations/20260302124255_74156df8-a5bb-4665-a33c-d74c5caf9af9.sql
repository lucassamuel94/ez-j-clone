
-- Function to get all filtered lead IDs (no pagination)
CREATE OR REPLACE FUNCTION public.get_filtered_lead_ids(
  p_tab text,
  p_sdr_id uuid DEFAULT NULL,
  p_search text DEFAULT '',
  p_statuses text[] DEFAULT NULL,
  p_limit integer DEFAULT NULL
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result text[];
BEGIN
  -- Reuse the same filtering logic as search_leads_paginated
  WITH filtered AS (
    SELECT l.id
    FROM leads l
    WHERE
      -- Tab filter
      CASE p_tab
        WHEN 'overdue' THEN l.status NOT IN ('Descartado', 'Oportunidade criada', 'Reunião agendada', 'Reunião confirmada', 'Oportunidade futura')
          AND l.next_action_at < now()
        WHEN 'today' THEN l.status NOT IN ('Descartado', 'Oportunidade criada', 'Oportunidade futura')
          AND l.next_action_at >= date_trunc('day', now())
          AND l.next_action_at < date_trunc('day', now()) + interval '1 day'
        WHEN 'new' THEN l.status = 'Novo'
        WHEN 'in_contact_return' THEN l.status IN ('Em contato', 'Retorno')
        WHEN 'devolvido_closer' THEN l.status = 'Devolvido pelo closer'
        WHEN 'ocupado' THEN l.status = 'Ocupado'
        WHEN 'nao_atendeu' THEN l.status = 'Não atendeu'
        WHEN 'sem_retorno' THEN l.status = 'Sem retorno'
        WHEN 'agendar_retorno' THEN l.status = 'Agendar retorno'
        WHEN 'scheduled' THEN l.status = 'Reunião agendada'
        WHEN 'confirmed' THEN l.status = 'Reunião confirmada'
        WHEN 'future_opportunity' THEN l.status = 'Oportunidade futura'
        WHEN 'discarded' THEN l.status = 'Descartado'
        ELSE l.status NOT IN ('Descartado', 'Oportunidade criada', 'Oportunidade futura')
      END
      -- SDR filter
      AND (
        p_sdr_id IS NULL
        OR (p_sdr_id = '00000000-0000-0000-0000-000000000000' AND l.owner_user_id IS NULL)
        OR l.owner_user_id = p_sdr_id
      )
      -- Status filter
      AND (p_statuses IS NULL OR l.status = ANY(p_statuses))
      -- Search filter
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

-- Function to get all filtered opportunity IDs (no pagination)
CREATE OR REPLACE FUNCTION public.get_filtered_opportunity_ids(
  p_tab text,
  p_closer_id uuid DEFAULT NULL,
  p_search text DEFAULT '',
  p_stages text[] DEFAULT NULL,
  p_meeting_from timestamptz DEFAULT NULL,
  p_meeting_to timestamptz DEFAULT NULL,
  p_won_from timestamptz DEFAULT NULL,
  p_won_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT NULL
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result text[];
BEGIN
  WITH filtered AS (
    SELECT o.id
    FROM opportunities o
    LEFT JOIN leads l ON l.id = o.lead_id
    WHERE
      -- Tab filter
      CASE p_tab
        WHEN 'oportunidades' THEN o.stage NOT IN ('Venda Realizada', 'Perdido')
        WHEN 'reunioes' THEN o.stage NOT IN ('Venda Realizada', 'Perdido') AND o.meeting_datetime IS NOT NULL
        WHEN 'vendas' THEN o.stage = 'Venda Realizada'
        ELSE o.stage NOT IN ('Venda Realizada', 'Perdido')
      END
      -- Closer filter
      AND (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id)
      -- Stage filter
      AND (p_stages IS NULL OR o.stage = ANY(p_stages))
      -- Meeting date range
      AND (p_meeting_from IS NULL OR o.meeting_datetime >= p_meeting_from)
      AND (p_meeting_to IS NULL OR o.meeting_datetime <= p_meeting_to)
      -- Won date range
      AND (p_won_from IS NULL OR o.won_at >= p_won_from)
      AND (p_won_to IS NULL OR o.won_at <= p_won_to)
      -- Search filter
      AND (
        p_search = '' OR p_search IS NULL
        OR l.name ILIKE '%' || p_search || '%'
        OR l.company ILIKE '%' || p_search || '%'
        OR l.razao_social ILIKE '%' || p_search || '%'
        OR l.nome_fantasia ILIKE '%' || p_search || '%'
        OR l.email ILIKE '%' || p_search || '%'
        OR l.phone ILIKE '%' || p_search || '%'
        OR l.whatsapp ILIKE '%' || p_search || '%'
        OR l.cnpj ILIKE '%' || p_search || '%'
      )
    ORDER BY o.created_at DESC
    LIMIT p_limit
  )
  SELECT array_agg(filtered.id::text) INTO result FROM filtered;
  
  RETURN COALESCE(result, ARRAY[]::text[]);
END;
$$;
