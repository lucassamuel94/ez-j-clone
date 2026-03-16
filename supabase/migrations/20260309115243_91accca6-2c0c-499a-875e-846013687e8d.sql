
-- Step 1: Add new enum values only
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'suporte';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'verificacao_bm';

-- Insert system roles into roles table
INSERT INTO public.roles (name, description, is_system, is_default)
VALUES
  ('Suporte', 'Equipe de suporte com acesso a projetos', true, false),
  ('Verificação BM', 'Responsável pela verificação de Business Manager', true, false)
ON CONFLICT DO NOTHING;
