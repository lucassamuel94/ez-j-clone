
-- Deduplicate leads by razao_social (case-sensitive) - v3
-- Completely skip cnpj enrichment due to unique constraint

DO $$
DECLARE
  rec RECORD;
  keep_id uuid;
  dup_ids uuid[];
  enrich_fields text[] := ARRAY[
    'email','phone','website','company_segment','city','state',
    'whatsapp','phone_2','employee_count','revenue_range','nome_fantasia',
    'porte','cnae_fiscal','cnae_fiscal_descricao','cep','logradouro',
    'bairro','numero','complemento','situacao_cadastral','cnaes_secundarios',
    'data_inicio_atividade','qsa','capital_social','account_id'
  ];
  f text;
  enrich_sql text;
  total_removed int := 0;
BEGIN
  FOR rec IN
    SELECT razao_social AS rs,
           array_agg(id ORDER BY
             COALESCE(last_contact_at, '1970-01-01'::timestamptz) DESC,
             COALESCE(updated_at, '1970-01-01'::timestamptz) DESC,
             created_at DESC
           ) AS ids
    FROM leads
    WHERE razao_social IS NOT NULL AND razao_social <> ''
    GROUP BY razao_social
    HAVING count(*) > 1
  LOOP
    keep_id := rec.ids[1];
    dup_ids := rec.ids[2:];

    -- 1. Enrich keeper with missing data (skip cnpj due to unique constraint)
    FOREACH f IN ARRAY enrich_fields LOOP
      enrich_sql := format(
        'UPDATE leads SET %I = (
          SELECT %I FROM leads WHERE id = ANY($1) AND %I IS NOT NULL AND %I::text <> '''' AND %I::text <> ''0'' LIMIT 1
        ) WHERE id = $2 AND (%I IS NULL OR %I::text = '''' OR %I::text = ''0'')',
        f, f, f, f, f, f, f, f
      );
      EXECUTE enrich_sql USING dup_ids, keep_id;
    END LOOP;

    -- 2. Migrate dependent tables
    UPDATE opportunities SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE lead_notes SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE lead_contacts SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE interactions SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    DELETE FROM lead_cadences WHERE lead_id = ANY(dup_ids);
    UPDATE call_history SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE call_analyses SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE lead_activity_logs SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE lead_score_history SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE sent_emails SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE form_submissions SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE ai_usage_logs SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE projects SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);
    UPDATE project_tasks SET lead_id = keep_id WHERE lead_id = ANY(dup_ids);

    -- 3. Remove cnpj from duplicates to avoid unique constraint on delete cascade
    UPDATE leads SET cnpj = NULL WHERE id = ANY(dup_ids) AND cnpj IS NOT NULL;

    -- 4. Delete duplicates
    DELETE FROM leads WHERE id = ANY(dup_ids);
    total_removed := total_removed + array_length(dup_ids, 1);
  END LOOP;

  RAISE NOTICE 'Deduplication complete. Total leads removed: %', total_removed;
END $$;
