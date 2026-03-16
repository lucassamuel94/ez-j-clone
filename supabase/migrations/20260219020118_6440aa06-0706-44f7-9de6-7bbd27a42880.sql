
-- Add a bm_data JSONB column to project_phases to store Verificação BM specific data
ALTER TABLE public.project_phases ADD COLUMN IF NOT EXISTS bm_data jsonb DEFAULT NULL;

COMMENT ON COLUMN public.project_phases.bm_data IS 'Stores Verificação BM specific data: cnpj, razao_social, tipo_cliente, executivo, responsavel, telefone, email, site, versao_plataforma, descricao';
