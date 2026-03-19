-- ============================================================
-- LIMPEZA DE DUPLICATAS — LEADS + OPORTUNIDADES
-- ⚠️  RODE O DIAGNÓSTICO ANTES e valide os resultados!
-- ⚠️  Faça backup da base antes de executar.
-- ============================================================

BEGIN;

-- ── PARTE 1: DEDUP DE LEADS ────────────────────────────────
-- Match fuzzy por LOWER(UNACCENT(TRIM(razao_social ou company)))
-- Mantém o lead com last_contact_at mais recente
-- Transfere todos os dados dependentes para o lead mantido

DO $$
DECLARE
  rec RECORD;
  keep_id uuid;
  dup_ids uuid[];
  enrich_fields text[] := ARRAY[
    'email','phone','website','company_segment','city','state',
    'whatsapp','phone_2','phone_3','phone_4','email_2','contact_name_2',
    'employee_count','revenue_range','nome_fantasia',
    'porte','cnae_fiscal','cnae_fiscal_descricao','cep','logradouro',
    'bairro','numero','complemento','situacao_cadastral','cnaes_secundarios',
    'data_inicio_atividade','qsa','capital_social','account_id',
    'initial_message','entry_channel','icp_fit','source',
    'sqo_pain_category','sqo_pain_clear','sqo_pain_financial_impact',
    'sqo_urgency','sqo_budget','sqo_decision_maker','sqo_icp_fit',
    'ai_enrichment_data','ai_insights_data'
  ];
  f text;
  enrich_sql text;
  total_removed int := 0;
BEGIN
  RAISE NOTICE '=== INICIANDO DEDUP DE LEADS (fuzzy name) ===';

  FOR rec IN
    SELECT
      LOWER(TRIM(UNACCENT(COALESCE(razao_social, company)))) AS norm_name,
      array_agg(id ORDER BY
        COALESCE(last_contact_at, '1970-01-01'::timestamptz) DESC,
        COALESCE(updated_at, '1970-01-01'::timestamptz) DESC,
        created_at DESC
      ) AS ids
    FROM leads
    WHERE COALESCE(razao_social, company) IS NOT NULL
      AND TRIM(COALESCE(razao_social, company)) <> ''
    GROUP BY LOWER(TRIM(UNACCENT(COALESCE(razao_social, company))))
    HAVING count(*) > 1
  LOOP
    keep_id := rec.ids[1];
    dup_ids := rec.ids[2:];

    RAISE NOTICE 'Merging "%": keep=% dupes=%', rec.norm_name, keep_id, array_length(dup_ids, 1);

    -- 1. Enrich keeper with missing data from duplicates (skip cnpj — unique constraint)
    FOREACH f IN ARRAY enrich_fields LOOP
      enrich_sql := format(
        'UPDATE leads SET %I = (
          SELECT %I FROM leads WHERE id = ANY($1) AND %I IS NOT NULL AND %I::text <> '''' AND %I::text <> ''0'' LIMIT 1
        ) WHERE id = $2 AND (%I IS NULL OR %I::text = '''' OR %I::text = ''0'')',
        f, f, f, f, f, f, f, f
      );
      EXECUTE enrich_sql USING dup_ids, keep_id;
    END LOOP;

    -- 2. Transfer all dependent records to keeper
    UPDATE opportunities SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE lead_notes SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE lead_contacts SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE interactions SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE meetings SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    DELETE FROM lead_cadences WHERE lead_id = ANY(dup_ids);
    DELETE FROM email_sequence_enrollments WHERE lead_id = ANY(dup_ids);
    UPDATE call_history SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE call_analyses SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE lead_activity_logs SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE lead_score_history SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE sent_emails SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE form_submissions SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE ai_usage_logs SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE projects SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE project_tasks SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);

    -- 3. Clear cnpj on duplicates to avoid unique constraint violation
    UPDATE leads SET cnpj = NULL WHERE id = ANY(dup_ids) AND cnpj IS NOT NULL;

    -- 4. Delete duplicates
    DELETE FROM leads WHERE id = ANY(dup_ids);
    total_removed := total_removed + array_length(dup_ids, 1);
  END LOOP;

  RAISE NOTICE '=== LEADS DEDUP COMPLETO. Removidos: % ===', total_removed;
END $$;


-- ── PARTE 2: DEDUP DE OPORTUNIDADES ───────────────────────
-- Para cada lead, se existem múltiplas oportunidades ativas (não Perdido/Ganho),
-- manter a que tem proposta ou updated_at mais recente.
-- Transfere proposals, projects, project_tasks para a oportunidade mantida.

DO $$
DECLARE
  rec RECORD;
  keep_id uuid;
  dup_ids uuid[];
  total_removed int := 0;
BEGIN
  RAISE NOTICE '=== INICIANDO DEDUP DE OPORTUNIDADES ===';

  FOR rec IN
    SELECT
      o.lead_id,
      array_agg(o.id ORDER BY
        -- Prioridade 1: tem proposta
        CASE WHEN EXISTS (SELECT 1 FROM proposals p WHERE p.opportunity_id = o.id) THEN 0 ELSE 1 END,
        -- Prioridade 2: tem projeto
        CASE WHEN EXISTS (SELECT 1 FROM projects p WHERE p.opportunity_id = o.id) THEN 0 ELSE 1 END,
        -- Prioridade 3: atividade mais recente
        o.updated_at DESC NULLS LAST,
        o.created_at DESC
      ) AS ids
    FROM opportunities o
    WHERE o.stage NOT IN ('Perdido', 'Ganho')
      AND o.returned_to_sdr = false
    GROUP BY o.lead_id
    HAVING count(*) > 1
  LOOP
    keep_id := rec.ids[1];
    dup_ids := rec.ids[2:];

    RAISE NOTICE 'Merging opps for lead=%: keep=% dupes=%', rec.lead_id, keep_id, array_length(dup_ids, 1);

    -- 1. Transfer proposals to keeper
    UPDATE proposals SET opportunity_id = keep_id WHERE opportunity_id = ANY(dup_ids);

    -- 2. Transfer projects to keeper
    UPDATE projects SET opportunity_id = keep_id WHERE opportunity_id = ANY(dup_ids);

    -- 3. Transfer tasks to keeper
    UPDATE project_tasks SET opportunity_id = keep_id WHERE opportunity_id = ANY(dup_ids);

    -- 4. Keep the best deal_value (highest) and closer_notes
    UPDATE opportunities SET
      deal_value = GREATEST(
        deal_value,
        (SELECT MAX(deal_value) FROM opportunities WHERE id = ANY(dup_ids))
      ),
      closer_notes = COALESCE(
        closer_notes,
        (SELECT closer_notes FROM opportunities WHERE id = ANY(dup_ids) AND closer_notes IS NOT NULL LIMIT 1)
      )
    WHERE id = keep_id;

    -- 5. Delete duplicate opportunities
    DELETE FROM opportunities WHERE id = ANY(dup_ids);
    total_removed := total_removed + array_length(dup_ids, 1);
  END LOOP;

  RAISE NOTICE '=== OPORTUNIDADES DEDUP COMPLETO. Removidas: % ===', total_removed;
END $$;

-- Se tudo estiver OK, descomente a linha abaixo:
-- COMMIT;
-- Se algo deu errado:
ROLLBACK;
