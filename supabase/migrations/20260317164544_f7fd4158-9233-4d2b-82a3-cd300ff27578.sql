
CREATE OR REPLACE FUNCTION public.search_accounts_for_deal(search_term text, result_limit int DEFAULT 100)
RETURNS TABLE (
  id uuid, company_name text, cnpj text, razao_social text, nome_fantasia text,
  contact_name text, email text, phone text, company_segment text,
  cnae_fiscal int, cnae_fiscal_descricao text, cnaes_secundarios text,
  porte text, employee_count text, revenue_range text, capital_social numeric,
  city text, state text, cep text, website text, situacao_cadastral text,
  data_inicio_atividade text, ai_enrichment_data jsonb, notes text,
  created_at timestamptz, account_owner_id uuid, account_owner_name text,
  status text, lifecycle_stage text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id, a.company_name, a.cnpj, a.razao_social, a.nome_fantasia,
         a.contact_name, a.email, a.phone, a.company_segment,
         a.cnae_fiscal, a.cnae_fiscal_descricao, a.cnaes_secundarios,
         a.porte, a.employee_count, a.revenue_range, a.capital_social,
         a.city, a.state, a.cep, a.website, a.situacao_cadastral,
         a.data_inicio_atividade, a.ai_enrichment_data, a.notes,
         a.created_at, a.account_owner_id, p.name AS account_owner_name,
         a.status, a.lifecycle_stage
  FROM accounts a
  LEFT JOIN profiles p ON p.id = a.account_owner_id
  WHERE search_term IS NOT NULL AND length(trim(search_term)) >= 2
    AND (
      a.company_name ILIKE '%' || search_term || '%'
      OR a.cnpj ILIKE '%' || search_term || '%'
      OR a.razao_social ILIKE '%' || search_term || '%'
      OR a.nome_fantasia ILIKE '%' || search_term || '%'
    )
  ORDER BY a.company_name
  LIMIT result_limit;
$$;
