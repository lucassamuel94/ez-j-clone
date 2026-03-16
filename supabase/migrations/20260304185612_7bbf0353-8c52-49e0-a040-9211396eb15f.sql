UPDATE public.leads
SET company_segment = cnae_fiscal_descricao
WHERE cnae_fiscal_descricao IS NOT NULL
  AND cnae_fiscal_descricao != ''
  AND (company_segment IS NULL OR company_segment = '');