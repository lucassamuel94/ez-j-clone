-- =============================================================================
-- Kanban performance: composite indexes + server-side RPC per stage
-- =============================================================================

-- 1. SDR Kanban: composite index speeds up search_leads_by_status WHERE clause
CREATE INDEX IF NOT EXISTS idx_leads_status_owner
  ON public.leads(status, owner_user_id);

-- 2. Closer Kanban: composite index for per-stage filtered queries
CREATE INDEX IF NOT EXISTS idx_opportunities_stage_closer
  ON public.opportunities(stage, assigned_to_user_id, opportunity_type)
  WHERE returned_to_sdr = false;

-- =============================================================================
-- search_opportunities_kanban
-- Returns paginated opportunities for a single pipeline stage.
-- Used by the Closer Kanban view (one query per visible column).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.search_opportunities_kanban(
  p_stage           text,
  p_closer_id       uuid    DEFAULT NULL,
  p_search          text    DEFAULT '',
  p_opportunity_type text   DEFAULT 'new_business',
  p_page            int     DEFAULT 1,
  p_page_size       int     DEFAULT 15,
  p_sort            text    DEFAULT 'created_desc'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset  int  := (p_page - 1) * p_page_size;
  v_search  text := lower(trim(unaccent(p_search)));
  v_total   int;
  v_data    jsonb;
BEGIN
  -- ── Count ────────────────────────────────────────────────────────────────
  SELECT COUNT(*)
  INTO   v_total
  FROM   public.opportunities o
  JOIN   public.leads l ON l.id = o.lead_id
  WHERE  o.stage              = p_stage
    AND  o.returned_to_sdr    = false
    AND  o.opportunity_type   = p_opportunity_type
    AND  (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id)
    AND  (
      v_search = ''
      OR unaccent(lower(l.name))                          ILIKE '%' || v_search || '%'
      OR unaccent(lower(COALESCE(l.company,       '')))   ILIKE '%' || v_search || '%'
      OR unaccent(lower(COALESCE(l.razao_social,  '')))   ILIKE '%' || v_search || '%'
      OR unaccent(lower(COALESCE(l.nome_fantasia, '')))   ILIKE '%' || v_search || '%'
      OR COALESCE(l.cnpj,     '') ILIKE '%' || p_search || '%'
      OR COALESCE(l.whatsapp, '') ILIKE '%' || p_search || '%'
      OR COALESCE(l.email,    '') ILIKE '%' || p_search || '%'
    );

  -- ── Paginated data ────────────────────────────────────────────────────────
  SELECT jsonb_agg(row_to_json(t))
  INTO   v_data
  FROM (
    SELECT
      o.id,
      o.lead_id,
      o.stage,
      o.created_by_user_id,
      o.assigned_to_user_id,
      o.sdr_user_id,
      o.closer_notes,
      o.returned_to_sdr,
      o.return_reason,
      o.lost_reason,
      o.meeting_datetime,
      o.deal_value,
      o.created_at,
      o.updated_at,
      o.active_objection,
      o.expected_close_date,
      o.decision_maker_identified,
      o.won_at,
      o.opportunity_type,
      l.name                                                   AS lead_name,
      COALESCE(l.razao_social, l.nome_fantasia, l.company)     AS lead_company,
      l.razao_social                                           AS lead_razao_social,
      l.nome_fantasia                                          AS lead_nome_fantasia,
      l.cnpj                                                   AS lead_cnpj,
      l.whatsapp                                               AS lead_whatsapp,
      l.phone                                                  AS lead_phone,
      l.phone_2                                                AS lead_phone_2,
      l.phone_3                                                AS lead_phone_3,
      l.phone_4                                                AS lead_phone_4,
      l.email                                                  AS lead_email,
      l.temperature                                            AS lead_temperature,
      l.last_contact_at                                        AS lead_last_contact_at,
      l.next_action_at                                         AS lead_next_action_at,
      l.status                                                 AS lead_status,
      l.website                                                AS lead_website,
      sdr_p.name                                               AS sdr_name,
      closer_p.name                                            AS closer_name
    FROM   public.opportunities o
    JOIN   public.leads l ON l.id = o.lead_id
    LEFT JOIN public.profiles sdr_p    ON sdr_p.id    = o.sdr_user_id
    LEFT JOIN public.profiles closer_p ON closer_p.id = o.assigned_to_user_id
    WHERE  o.stage              = p_stage
      AND  o.returned_to_sdr    = false
      AND  o.opportunity_type   = p_opportunity_type
      AND  (p_closer_id IS NULL OR o.assigned_to_user_id = p_closer_id)
      AND  (
        v_search = ''
        OR unaccent(lower(l.name))                          ILIKE '%' || v_search || '%'
        OR unaccent(lower(COALESCE(l.company,       '')))   ILIKE '%' || v_search || '%'
        OR unaccent(lower(COALESCE(l.razao_social,  '')))   ILIKE '%' || v_search || '%'
        OR unaccent(lower(COALESCE(l.nome_fantasia, '')))   ILIKE '%' || v_search || '%'
        OR COALESCE(l.cnpj,     '') ILIKE '%' || p_search || '%'
        OR COALESCE(l.whatsapp, '') ILIKE '%' || p_search || '%'
        OR COALESCE(l.email,    '') ILIKE '%' || p_search || '%'
      )
    ORDER BY
      -- value_desc
      CASE WHEN p_sort = 'value_desc'        THEN o.deal_value       END DESC NULLS LAST,
      -- next_action_asc
      CASE WHEN p_sort = 'next_action_asc'   THEN l.next_action_at   END ASC  NULLS LAST,
      -- temperature_desc (quente=3, morno=2, frio=1)
      CASE WHEN p_sort = 'temperature_desc'  THEN
        CASE lower(l.temperature)
          WHEN 'quente' THEN 3
          WHEN 'morno'  THEN 2
          WHEN 'frio'   THEN 1
          ELSE 0
        END
      END DESC NULLS LAST,
      -- last_contact_asc
      CASE WHEN p_sort = 'last_contact_asc'  THEN l.last_contact_at  END ASC  NULLS LAST,
      -- default / created_desc tiebreaker
      o.created_at DESC
    LIMIT  p_page_size
    OFFSET v_offset
  ) t;

  RETURN jsonb_build_object(
    'total', v_total,
    'data',  COALESCE(v_data, '[]'::jsonb)
  );
END;
$$;
