
-- Drop the existing unique index on cnpj
DROP INDEX IF EXISTS public.leads_cnpj_unique;

-- Create a partial unique index that only applies to valid CNPJs
CREATE UNIQUE INDEX leads_cnpj_unique ON public.leads (cnpj) 
WHERE cnpj IS NOT NULL AND cnpj != '' AND cnpj != '0';
