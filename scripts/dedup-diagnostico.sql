-- ============================================================
-- DIAGNÓSTICO DE DUPLICATAS — LEADS + OPORTUNIDADES
-- Rode este script ANTES da limpeza para revisar o que será afetado
-- ============================================================

-- ── 1. DUPLICATAS DE LEADS (SDR Pipeline) ──────────────────

-- 1a. Por CNPJ (match exato, ignora vazios)
WITH cnpj_groups AS (
  SELECT
    NULLIF(TRIM(REGEXP_REPLACE(cnpj, '\D', '', 'g')), '') AS clean_cnpj,
    count(*) AS total,
    array_agg(id ORDER BY COALESCE(last_contact_at, '1970-01-01'::timestamptz) DESC, updated_at DESC) AS ids,
    array_agg(company ORDER BY COALESCE(last_contact_at, '1970-01-01'::timestamptz) DESC, updated_at DESC) AS companies,
    array_agg(status ORDER BY COALESCE(last_contact_at, '1970-01-01'::timestamptz) DESC, updated_at DESC) AS statuses
  FROM leads
  WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
  GROUP BY clean_cnpj
  HAVING count(*) > 1
)
SELECT
  'CNPJ' AS match_type,
  clean_cnpj AS match_key,
  total AS duplicatas,
  companies[1] AS manter_empresa,
  statuses[1] AS manter_status,
  ids[1] AS manter_id,
  total - 1 AS remover_qtd
FROM cnpj_groups
ORDER BY total DESC;

-- 1b. Por nome fuzzy (LOWER + unaccent + trim, ignora vazios)
WITH name_groups AS (
  SELECT
    LOWER(TRIM(UNACCENT(COALESCE(razao_social, company)))) AS norm_name,
    count(*) AS total,
    array_agg(id ORDER BY COALESCE(last_contact_at, '1970-01-01'::timestamptz) DESC, updated_at DESC) AS ids,
    array_agg(company ORDER BY COALESCE(last_contact_at, '1970-01-01'::timestamptz) DESC, updated_at DESC) AS companies,
    array_agg(status ORDER BY COALESCE(last_contact_at, '1970-01-01'::timestamptz) DESC, updated_at DESC) AS statuses
  FROM leads
  WHERE COALESCE(razao_social, company) IS NOT NULL
    AND TRIM(COALESCE(razao_social, company)) <> ''
  GROUP BY norm_name
  HAVING count(*) > 1
)
SELECT
  'NOME' AS match_type,
  norm_name AS match_key,
  total AS duplicatas,
  companies[1] AS manter_empresa,
  statuses[1] AS manter_status,
  ids[1] AS manter_id,
  total - 1 AS remover_qtd
FROM name_groups
WHERE norm_name NOT IN (
  -- Excluir grupos já cobertos pelo match de CNPJ
  SELECT LOWER(TRIM(UNACCENT(COALESCE(l.razao_social, l.company))))
  FROM leads l
  WHERE l.cnpj IS NOT NULL AND TRIM(l.cnpj) <> ''
  GROUP BY NULLIF(TRIM(REGEXP_REPLACE(l.cnpj, '\D', '', 'g')), ''),
           LOWER(TRIM(UNACCENT(COALESCE(l.razao_social, l.company))))
  HAVING count(*) > 1
)
ORDER BY total DESC;

-- 1c. Resumo geral de leads
SELECT
  'LEADS — Total de grupos duplicados (CNPJ)' AS metrica,
  count(*) AS valor
FROM (
  SELECT NULLIF(TRIM(REGEXP_REPLACE(cnpj, '\D', '', 'g')), '') AS c
  FROM leads WHERE cnpj IS NOT NULL AND TRIM(cnpj) <> ''
  GROUP BY c HAVING count(*) > 1
) t
UNION ALL
SELECT
  'LEADS — Total de grupos duplicados (Nome fuzzy)',
  count(*)
FROM (
  SELECT LOWER(TRIM(UNACCENT(COALESCE(razao_social, company)))) AS n
  FROM leads
  WHERE COALESCE(razao_social, company) IS NOT NULL AND TRIM(COALESCE(razao_social, company)) <> ''
  GROUP BY n HAVING count(*) > 1
) t
UNION ALL
SELECT
  'LEADS — Total de registros que seriam removidos',
  COALESCE(SUM(cnt - 1), 0)
FROM (
  SELECT LOWER(TRIM(UNACCENT(COALESCE(razao_social, company)))) AS n, count(*) AS cnt
  FROM leads
  WHERE COALESCE(razao_social, company) IS NOT NULL AND TRIM(COALESCE(razao_social, company)) <> ''
  GROUP BY n HAVING count(*) > 1
) t;

-- ── 2. DUPLICATAS DE OPORTUNIDADES (Closer Pipeline) ──────

-- Oportunidades duplicadas para o mesmo lead (excluindo Perdido/Ganho)
WITH opp_groups AS (
  SELECT
    o.lead_id,
    l.company,
    count(*) AS total,
    array_agg(o.id ORDER BY
      CASE WHEN EXISTS (SELECT 1 FROM proposals p WHERE p.opportunity_id = o.id) THEN 0 ELSE 1 END,
      o.updated_at DESC
    ) AS ids,
    array_agg(o.stage ORDER BY
      CASE WHEN EXISTS (SELECT 1 FROM proposals p WHERE p.opportunity_id = o.id) THEN 0 ELSE 1 END,
      o.updated_at DESC
    ) AS stages,
    array_agg(
      CASE WHEN EXISTS (SELECT 1 FROM proposals p WHERE p.opportunity_id = o.id) THEN 'SIM' ELSE 'NAO' END
      ORDER BY
        CASE WHEN EXISTS (SELECT 1 FROM proposals p WHERE p.opportunity_id = o.id) THEN 0 ELSE 1 END,
        o.updated_at DESC
    ) AS tem_proposta
  FROM opportunities o
  JOIN leads l ON l.id = o.lead_id
  WHERE o.stage NOT IN ('Perdido', 'Ganho')
    AND o.returned_to_sdr = false
  GROUP BY o.lead_id, l.company
  HAVING count(*) > 1
)
SELECT
  company,
  total AS duplicatas,
  stages[1] AS manter_stage,
  tem_proposta[1] AS manter_tem_proposta,
  ids[1] AS manter_id,
  total - 1 AS remover_qtd
FROM opp_groups
ORDER BY total DESC;

-- Resumo de oportunidades
SELECT
  'OPORTUNIDADES — Grupos com duplicatas ativas para mesmo lead' AS metrica,
  count(*) AS valor
FROM (
  SELECT lead_id
  FROM opportunities
  WHERE stage NOT IN ('Perdido', 'Ganho') AND returned_to_sdr = false
  GROUP BY lead_id HAVING count(*) > 1
) t;
