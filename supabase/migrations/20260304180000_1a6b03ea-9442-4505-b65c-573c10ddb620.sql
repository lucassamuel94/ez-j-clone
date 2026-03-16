CREATE OR REPLACE FUNCTION public.search_all_leads_global(p_search text, p_limit integer DEFAULT 15)
 RETURNS TABLE(lead_id uuid, lead_name text, lead_company text, lead_email text, lead_cnpj text, lead_status text, opportunity_id uuid, opp_stage text, pipeline_label text, owner_name text)
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
  SELECT
    l.id AS lead_id,
    l.name AS lead_name,
    l.company AS lead_company,
    l.email AS lead_email,
    l.cnpj AS lead_cnpj,
    l.status::text AS lead_status,
    o.id AS opportunity_id,
    o.stage AS opp_stage,
    CASE
      WHEN o.id IS NOT NULL AND o.stage NOT IN ('Ganho', 'Perdido') THEN 'closer'
      WHEN l.status::text = 'Reunião agendada' OR l.status::text = 'Oportunidade criada' THEN 'closer'
      WHEN o.id IS NOT NULL AND o.stage = 'Ganho' THEN 'cliente'
      ELSE 'sdr'
    END AS pipeline_label,
    CASE
      WHEN o.id IS NOT NULL AND o.stage NOT IN ('Ganho', 'Perdido') THEN closer_p.name
      ELSE p.name
    END AS owner_name
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
  ORDER BY
    CASE WHEN lower(unaccent(l.company)) ILIKE v_search || '%' THEN 0
         WHEN lower(unaccent(l.name)) ILIKE v_search || '%' THEN 1
         ELSE 2
    END,
    l.updated_at DESC
  LIMIT p_limit;
END;
$function$;