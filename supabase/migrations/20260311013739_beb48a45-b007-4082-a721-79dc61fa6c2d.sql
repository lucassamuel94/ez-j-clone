
CREATE OR REPLACE FUNCTION public.search_all_leads_global(p_search text, p_limit integer DEFAULT 15)
 RETURNS TABLE(
   lead_id uuid,
   lead_name text,
   lead_company text,
   lead_email text,
   lead_cnpj text,
   lead_status text,
   opportunity_id uuid,
   opp_stage text,
   pipeline_label text,
   owner_name text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_search text;
  v_search_clean text;
BEGIN
  IF length(trim(p_search)) < 2 THEN
    RETURN;
  END IF;

  v_search := lower(unaccent(trim(p_search)));
  v_search_clean := regexp_replace(v_search, '[.\-\/]', '', 'g');

  RETURN QUERY
  WITH matched AS (
    SELECT
      l.id,
      l.name,
      COALESCE(l.razao_social, l.nome_fantasia, l.company) AS company_display,
      l.email,
      l.cnpj,
      l.status::text AS lead_st,
      l.updated_at,
      o.id AS opp_id,
      o.stage AS opp_st,
      p.name AS sdr_name,
      closer_p.name AS closer_name,
      CASE
        WHEN o.id IS NOT NULL AND o.stage NOT IN ('Ganho', 'Perdido') THEN 1
        WHEN l.status::text IN ('Reunião agendada', 'Oportunidade criada') AND o.id IS NOT NULL THEN 1
        WHEN o.id IS NOT NULL AND o.stage = 'Ganho' THEN 2
        ELSE 3
      END AS pipeline_pri,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(
          NULLIF(regexp_replace(COALESCE(l.cnpj, ''), '\D', '', 'g'), ''),
          l.id::text
        )
        ORDER BY
          CASE
            WHEN o.id IS NOT NULL AND o.stage NOT IN ('Ganho', 'Perdido') THEN 1
            WHEN l.status::text IN ('Reunião agendada', 'Oportunidade criada') AND o.id IS NOT NULL THEN 1
            WHEN o.id IS NOT NULL AND o.stage = 'Ganho' THEN 2
            ELSE 3
          END,
          l.updated_at DESC
      ) AS rn
    FROM leads l
    LEFT JOIN LATERAL (
      SELECT op.id, op.stage, op.assigned_to_user_id
      FROM opportunities op
      WHERE op.lead_id = l.id
      ORDER BY op.created_at DESC
      LIMIT 1
    ) o ON true
    LEFT JOIN profiles p ON p.id = l.owner_user_id
    LEFT JOIN profiles closer_p ON closer_p.id = o.assigned_to_user_id
    WHERE (
      lower(unaccent(l.name)) ILIKE '%' || v_search || '%'
      OR lower(unaccent(l.company)) ILIKE '%' || v_search || '%'
      OR lower(unaccent(coalesce(l.razao_social, ''))) ILIKE '%' || v_search || '%'
      OR lower(unaccent(coalesce(l.nome_fantasia, ''))) ILIKE '%' || v_search || '%'
      OR l.email ILIKE '%' || v_search || '%'
      OR l.phone ILIKE '%' || v_search || '%'
      OR l.whatsapp ILIKE '%' || v_search || '%'
      OR regexp_replace(coalesce(l.cnpj, ''), '[.\-\/]', '', 'g') ILIKE '%' || v_search_clean || '%'
    )
  )
  SELECT
    m.id AS lead_id,
    m.name AS lead_name,
    m.company_display AS lead_company,
    m.email AS lead_email,
    m.cnpj AS lead_cnpj,
    m.lead_st AS lead_status,
    m.opp_id AS opportunity_id,
    m.opp_st AS opp_stage,
    CASE
      WHEN m.pipeline_pri = 1 THEN 'closer'
      WHEN m.pipeline_pri = 2 THEN 'cliente'
      ELSE 'sdr'
    END AS pipeline_label,
    CASE
      WHEN m.pipeline_pri IN (1, 2) THEN m.closer_name
      ELSE m.sdr_name
    END AS owner_name
  FROM matched m
  WHERE m.rn = 1
  ORDER BY
    CASE WHEN lower(unaccent(m.company_display)) ILIKE v_search || '%' THEN 0
         WHEN lower(unaccent(m.name)) ILIKE v_search || '%' THEN 1
         ELSE 2
    END,
    m.updated_at DESC
  LIMIT p_limit;
END;
$function$;
