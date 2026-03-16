-- Create a unique index on cnpj (ignoring empty/null values)
CREATE UNIQUE INDEX IF NOT EXISTS leads_cnpj_unique 
ON public.leads (cnpj) 
WHERE cnpj IS NOT NULL AND cnpj != '' AND length(replace(cnpj, '.', '')) > 0;