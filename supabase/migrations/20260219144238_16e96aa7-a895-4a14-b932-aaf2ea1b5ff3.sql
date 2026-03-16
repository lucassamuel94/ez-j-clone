
-- Tabelas
CREATE TABLE public.permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'navigation',
  description text NOT NULL DEFAULT ''
);
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view permissions" ON public.permissions FOR SELECT USING (true);
CREATE POLICY "Admins can manage permissions" ON public.permissions FOR ALL USING (is_admin(auth.uid()));

CREATE TABLE public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view roles" ON public.roles FOR SELECT USING (true);
CREATE POLICY "Admins can insert roles" ON public.roles FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update roles" ON public.roles FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete non-system roles" ON public.roles FOR DELETE USING (is_admin(auth.uid()) AND NOT is_system);

CREATE TABLE public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view role_permissions" ON public.role_permissions FOR SELECT USING (true);
CREATE POLICY "Admins can insert role_permissions" ON public.role_permissions FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can delete role_permissions" ON public.role_permissions FOR DELETE USING (is_admin(auth.uid()));

-- Alterar user_roles e user_invitations
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles(id);
ALTER TABLE public.user_invitations ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles(id);

-- Seed permissões
INSERT INTO public.permissions (name, category, description) VALUES
  ('view_dashboard', 'navigation', 'Ver Dashboard'),
  ('view_notifications', 'navigation', 'Ver Notificações'),
  ('view_tasks', 'navigation', 'Ver Minhas Tarefas'),
  ('view_calendar', 'navigation', 'Ver Calendário'),
  ('view_sdr_leads', 'commercial', 'Ver Leads (SDR)'),
  ('view_sdr_indicators', 'commercial', 'Ver Indicadores SDR'),
  ('view_closer_pipeline', 'commercial', 'Ver Pipeline Closer'),
  ('view_closer_indicators', 'commercial', 'Ver Indicadores Closer'),
  ('view_proposals', 'commercial', 'Ver Propostas'),
  ('view_cadences', 'commercial', 'Ver Cadências'),
  ('view_projects', 'projects', 'Ver Projetos'),
  ('view_project_phases', 'projects', 'Ver Etapas de Projetos'),
  ('access_admin', 'management', 'Acessar Painel Admin'),
  ('manage_users', 'management', 'Gerenciar Usuários'),
  ('manage_invitations', 'management', 'Gerenciar Convites'),
  ('manage_goals', 'management', 'Gerenciar Metas'),
  ('manage_import', 'management', 'Importar Dados'),
  ('manage_products', 'management', 'Gerenciar Produtos'),
  ('manage_ai', 'management', 'Configurar IA'),
  ('manage_enrichment', 'management', 'Enriquecimento'),
  ('manage_email_templates', 'management', 'Templates de Email'),
  ('access_call_intelligence', 'management', 'Call Intelligence'),
  ('manage_roles', 'management', 'Gerenciar Perfis'),
  ('view_simulator', 'tools', 'Ver Simulador'),
  ('manage_embed_form', 'management', 'Formulário Embed');

-- Seed roles
INSERT INTO public.roles (name, description, is_default, is_system) VALUES
  ('Administrador', 'Acesso total ao sistema', false, true),
  ('Gerente', 'Gestão operacional sem controle de usuários', false, true),
  ('SDR', 'Prospecção e qualificação de leads', false, true),
  ('Closer', 'Fechamento de negócios e pipeline', false, true),
  ('Head Pós-Venda', 'Gestão de pós-venda com acesso administrativo', false, true),
  ('UX/PO', 'Gestão de projetos - UX e produto', false, true),
  ('Dev Chatbot', 'Gestão de projetos - desenvolvimento', false, true),
  ('Treinamento', 'Gestão de projetos - treinamento', false, true),
  ('Viewer', 'Acesso somente leitura básico', true, true);

-- Seed role_permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.name = 'Administrador';

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.name = 'Head Pós-Venda';

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'Gerente' AND p.name NOT IN ('manage_users', 'manage_invitations', 'manage_roles');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'SDR' AND p.name IN ('view_dashboard','view_notifications','view_tasks','view_calendar','view_sdr_leads','view_sdr_indicators','view_cadences','view_simulator');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'Closer' AND p.name IN ('view_dashboard','view_notifications','view_tasks','view_calendar','view_closer_pipeline','view_closer_indicators','view_proposals','view_projects','view_project_phases','view_simulator');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name IN ('UX/PO', 'Dev Chatbot', 'Treinamento') AND p.name IN ('view_dashboard','view_notifications','view_tasks','view_calendar','view_projects','view_project_phases');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.name = 'Viewer' AND p.name IN ('view_dashboard','view_notifications','view_tasks');

-- Migrar user_roles existentes
UPDATE public.user_roles SET role_id = (SELECT id FROM public.roles WHERE name = 'Administrador') WHERE role = 'admin' AND role_id IS NULL;
UPDATE public.user_roles SET role_id = (SELECT id FROM public.roles WHERE name = 'Gerente') WHERE role = 'manager' AND role_id IS NULL;
UPDATE public.user_roles SET role_id = (SELECT id FROM public.roles WHERE name = 'SDR') WHERE role = 'sdr' AND role_id IS NULL;
UPDATE public.user_roles SET role_id = (SELECT id FROM public.roles WHERE name = 'Closer') WHERE role = 'closer' AND role_id IS NULL;
UPDATE public.user_roles SET role_id = (SELECT id FROM public.roles WHERE name = 'Head Pós-Venda') WHERE role = 'head_pos_venda' AND role_id IS NULL;
UPDATE public.user_roles SET role_id = (SELECT id FROM public.roles WHERE name = 'UX/PO') WHERE role = 'ux_po' AND role_id IS NULL;
UPDATE public.user_roles SET role_id = (SELECT id FROM public.roles WHERE name = 'Dev Chatbot') WHERE role = 'dev_chatbot' AND role_id IS NULL;
UPDATE public.user_roles SET role_id = (SELECT id FROM public.roles WHERE name = 'Treinamento') WHERE role = 'treinamento' AND role_id IS NULL;

-- Migrar invitations
UPDATE public.user_invitations SET role_id = (SELECT id FROM public.roles WHERE name = 'Administrador') WHERE role = 'admin' AND role_id IS NULL;
UPDATE public.user_invitations SET role_id = (SELECT id FROM public.roles WHERE name = 'Gerente') WHERE role = 'manager' AND role_id IS NULL;
UPDATE public.user_invitations SET role_id = (SELECT id FROM public.roles WHERE name = 'SDR') WHERE role = 'sdr' AND role_id IS NULL;
UPDATE public.user_invitations SET role_id = (SELECT id FROM public.roles WHERE name = 'Closer') WHERE role = 'closer' AND role_id IS NULL;
UPDATE public.user_invitations SET role_id = (SELECT id FROM public.roles WHERE name = 'Head Pós-Venda') WHERE role = 'head_pos_venda' AND role_id IS NULL;
UPDATE public.user_invitations SET role_id = (SELECT id FROM public.roles WHERE name = 'UX/PO') WHERE role = 'ux_po' AND role_id IS NULL;
UPDATE public.user_invitations SET role_id = (SELECT id FROM public.roles WHERE name = 'Dev Chatbot') WHERE role = 'dev_chatbot' AND role_id IS NULL;
UPDATE public.user_invitations SET role_id = (SELECT id FROM public.roles WHERE name = 'Treinamento') WHERE role = 'treinamento' AND role_id IS NULL;

-- Funções SQL
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id AND p.name = _perm_name
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT p.name FROM user_roles ur
  JOIN role_permissions rp ON rp.role_id = ur.role_id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = _user_id
$$;

-- Trigger de sincronização
CREATE OR REPLACE FUNCTION public.sync_role_enum_from_role_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _role_name text; _enum_value text;
BEGIN
  IF NEW.role_id IS NOT NULL THEN
    SELECT name INTO _role_name FROM roles WHERE id = NEW.role_id;
    _enum_value := CASE _role_name
      WHEN 'Administrador' THEN 'admin' WHEN 'Gerente' THEN 'manager'
      WHEN 'SDR' THEN 'sdr' WHEN 'Closer' THEN 'closer'
      WHEN 'Head Pós-Venda' THEN 'head_pos_venda' WHEN 'UX/PO' THEN 'ux_po'
      WHEN 'Dev Chatbot' THEN 'dev_chatbot' WHEN 'Treinamento' THEN 'treinamento'
      ELSE 'sdr' END;
    NEW.role := _enum_value::app_role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_role_enum
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_role_enum_from_role_id();

-- Atualizar handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _default_role_id uuid;
  _invitation_role app_role;
  _invitation_role_id uuid;
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email);

  SELECT role, role_id INTO _invitation_role, _invitation_role_id
  FROM public.user_invitations WHERE email = NEW.email AND accepted_at IS NULL AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;

  IF _invitation_role IS NOT NULL THEN
    IF _invitation_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id, role) VALUES (NEW.id, _invitation_role_id, _invitation_role);
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _invitation_role);
    END IF;
    UPDATE public.user_invitations SET accepted_at = now() WHERE email = NEW.email AND accepted_at IS NULL;
  ELSE
    SELECT id INTO _default_role_id FROM public.roles WHERE is_default = true LIMIT 1;
    INSERT INTO public.user_roles (user_id, role_id, role) VALUES (NEW.id, _default_role_id, 'sdr');
  END IF;
  RETURN NEW;
END;
$$;
