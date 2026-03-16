
-- Add missing company data columns from BrasilAPI
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS porte text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS capital_social numeric;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cnae_fiscal integer;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cnae_fiscal_descricao text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS complemento text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS situacao_cadastral text;
