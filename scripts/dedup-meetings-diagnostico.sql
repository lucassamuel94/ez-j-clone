-- ============================================================
-- DIAGNÓSTICO DE REUNIÕES DUPLICADAS
-- Identifica leads com múltiplos meetings (criados pelo bug no findExistingActiveMeeting)
-- ============================================================

-- 1. Reuniões duplicadas exatas (mesmo lead, mesma data/hora)
SELECT
  l.company,
  l.name AS contato,
  m.lead_id,
  m.meeting_datetime,
  count(*) AS duplicatas,
  min(m.created_at) AS primeira_criacao,
  max(m.created_at) AS ultima_criacao
FROM meetings m
JOIN leads l ON l.id = m.lead_id
GROUP BY l.company, l.name, m.lead_id, m.meeting_datetime
HAVING count(*) > 1
ORDER BY count(*) DESC;

-- 2. Múltiplas reuniões por lead (mesmo lead, datas diferentes — possíveis reagendamentos que criaram novos registros)
SELECT
  l.company,
  l.name AS contato,
  m.lead_id,
  count(*) AS total_meetings,
  array_agg(m.meeting_datetime::text ORDER BY m.meeting_datetime) AS datas,
  array_agg(m.id ORDER BY m.meeting_datetime) AS meeting_ids
FROM meetings m
JOIN leads l ON l.id = m.lead_id
GROUP BY l.company, l.name, m.lead_id
HAVING count(*) > 1
ORDER BY count(*) DESC;

-- 3. Resumo
SELECT 'Leads com reuniões duplicadas exatas (mesma data/hora)' AS metrica,
  count(*) AS grupos
FROM (
  SELECT lead_id, meeting_datetime
  FROM meetings
  GROUP BY lead_id, meeting_datetime
  HAVING count(*) > 1
) t
UNION ALL
SELECT 'Leads com múltiplas reuniões (datas diferentes)',
  count(*)
FROM (
  SELECT lead_id FROM meetings GROUP BY lead_id HAVING count(*) > 1
) t
UNION ALL
SELECT 'Total de registros duplicados que seriam removidos',
  COALESCE(SUM(cnt - 1), 0)
FROM (
  SELECT lead_id, count(*) AS cnt
  FROM meetings
  GROUP BY lead_id
  HAVING count(*) > 1
) t;
