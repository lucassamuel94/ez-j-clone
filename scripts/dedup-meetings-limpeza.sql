-- ============================================================
-- LIMPEZA DE REUNIÕES DUPLICADAS
-- ⚠️  RODE O DIAGNÓSTICO ANTES e valide os resultados!
--
-- Estratégia:
-- Para cada lead com múltiplas reuniões, manter APENAS a mais recente
-- (por meeting_datetime). Isso cobre:
--   1. Duplicatas exatas (mesmo lead, mesma data) — bug do findExistingActiveMeeting
--   2. Reagendamentos que criaram novos registros — manter só o último
-- ============================================================

BEGIN;

-- Etapa 1: Identificar meetings a deletar (todos exceto o mais recente por lead)
WITH ranked AS (
  SELECT
    id,
    lead_id,
    meeting_datetime,
    ROW_NUMBER() OVER (
      PARTITION BY lead_id
      ORDER BY
        meeting_datetime DESC NULLS LAST,
        created_at DESC
    ) AS rn
  FROM meetings
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
-- Preview: quantos serão deletados
SELECT
  count(*) AS meetings_a_deletar,
  (SELECT count(DISTINCT lead_id) FROM ranked WHERE rn > 1) AS leads_afetados
FROM to_delete;

-- Etapa 2: Deletar duplicados (manter apenas o mais recente por lead)
-- ⚠️  Descomente o bloco abaixo SOMENTE após validar o preview acima

/*
WITH ranked AS (
  SELECT
    id,
    lead_id,
    ROW_NUMBER() OVER (
      PARTITION BY lead_id
      ORDER BY
        meeting_datetime DESC NULLS LAST,
        created_at DESC
    ) AS rn
  FROM meetings
)
DELETE FROM meetings
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
*/

-- Etapa 3: Adicionar constraint para prevenir duplicatas futuras
-- Unique index no (lead_id) para garantir no máximo 1 meeting ativo por lead.
-- ⚠️  Descomente SOMENTE após a limpeza.

/*
CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_one_per_lead
  ON meetings (lead_id);
*/

-- Se tudo estiver OK, descomente:
-- COMMIT;
-- Se algo deu errado:
ROLLBACK;
