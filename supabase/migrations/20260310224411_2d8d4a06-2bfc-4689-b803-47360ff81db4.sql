
-- 1. Create system_config table
CREATE TABLE public.system_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Enable RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- 3. RLS: SELECT for authenticated users
CREATE POLICY "Authenticated users can read system_config"
  ON public.system_config FOR SELECT
  TO authenticated
  USING (true);

-- 4. RLS: INSERT/UPDATE/DELETE for admin/manager only
CREATE POLICY "Admins and managers can modify system_config"
  ON public.system_config FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_manager(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_manager(auth.uid()));

-- 5. Seed the default head user
INSERT INTO public.system_config (key, value, description)
VALUES (
  'default_head_user_id',
  'f9e18ed3-9c0e-4796-9850-557210870898',
  'Usuário padrão atribuído como Head em todos os projetos'
);

-- 6. Create RPC
CREATE OR REPLACE FUNCTION public.get_system_config(config_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.system_config WHERE key = config_key LIMIT 1;
$$;
