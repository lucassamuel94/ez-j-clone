
-- 1. Update is_admin() to include head_pos_venda
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'head_pos_venda')
  )
$$;

-- 2. Create is_project_member() helper
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('head_pos_venda', 'ux_po', 'dev_chatbot', 'treinamento')
  )
$$;

-- 3. Create projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_number serial NOT NULL,
  opportunity_id uuid REFERENCES public.opportunities(id),
  lead_id uuid REFERENCES public.leads(id),
  project_type text NOT NULL DEFAULT 'venda',
  current_phase text,
  overall_status text NOT NULL DEFAULT 'ativo',
  company_name text NOT NULL DEFAULT '',
  cnpj text,
  contact_name text,
  contact_phone text,
  contact_email text,
  version text,
  api_type text,
  plan_name text,
  has_integration boolean DEFAULT false,
  integrations_description text,
  extra_storage text,
  project_description text,
  broker text,
  has_coexistence boolean DEFAULT false,
  activation_phone text,
  has_ai boolean DEFAULT false,
  complexity_level text,
  priority text NOT NULL DEFAULT 'media',
  tags text[] DEFAULT '{}',
  start_date date,
  due_date date,
  estimated_hours numeric,
  created_by_user_id uuid REFERENCES public.profiles(id),
  closer_user_id uuid REFERENCES public.profiles(id),
  sdr_user_id uuid REFERENCES public.profiles(id),
  head_user_id uuid REFERENCES public.profiles(id),
  ux_po_user_id uuid REFERENCES public.profiles(id),
  dev_user_id uuid REFERENCES public.profiles(id),
  treinamento_user_id uuid REFERENCES public.profiles(id),
  checklist_data jsonb DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create project_phases table
CREATE TABLE public.project_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_name text NOT NULL,
  status text NOT NULL DEFAULT 'BACKLOG',
  assigned_user_id uuid REFERENCES public.profiles(id),
  started_at timestamptz,
  completed_at timestamptz,
  is_active boolean DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Create project_status_transitions table
CREATE TABLE public.project_status_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_name text NOT NULL,
  status text NOT NULL,
  entered_at timestamptz NOT NULL DEFAULT now(),
  exited_at timestamptz,
  duration_minutes integer,
  changed_by_user_id uuid REFERENCES public.profiles(id)
);

-- 6. Create project_activity_logs table
CREATE TABLE public.project_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id),
  action_type text NOT NULL,
  phase_name text,
  old_value text,
  new_value text,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. Indexes
CREATE INDEX idx_projects_opportunity_id ON public.projects(opportunity_id);
CREATE INDEX idx_projects_project_type ON public.projects(project_type);
CREATE INDEX idx_projects_overall_status ON public.projects(overall_status);
CREATE INDEX idx_projects_created_by ON public.projects(created_by_user_id);
CREATE INDEX idx_project_phases_project_id ON public.project_phases(project_id);
CREATE INDEX idx_project_phases_status ON public.project_phases(status);
CREATE INDEX idx_project_transitions_project_id ON public.project_status_transitions(project_id);
CREATE INDEX idx_project_transitions_open ON public.project_status_transitions(project_id) WHERE exited_at IS NULL;
CREATE INDEX idx_project_activity_project_id ON public.project_activity_logs(project_id);

-- 8. Updated_at triggers
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_phases_updated_at
  BEFORE UPDATE ON public.project_phases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_status_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activity_logs ENABLE ROW LEVEL SECURITY;

-- 10. RLS for projects
CREATE POLICY "Managers can view all projects"
  ON public.projects FOR SELECT
  USING (is_manager(auth.uid()));

CREATE POLICY "Project members can view assigned projects"
  ON public.projects FOR SELECT
  USING (
    ux_po_user_id = auth.uid() OR
    dev_user_id = auth.uid() OR
    treinamento_user_id = auth.uid() OR
    head_user_id = auth.uid()
  );

CREATE POLICY "Closers can view own projects"
  ON public.projects FOR SELECT
  USING (created_by_user_id = auth.uid());

CREATE POLICY "Managers can insert projects"
  ON public.projects FOR INSERT
  WITH CHECK (is_manager(auth.uid()) OR is_project_member(auth.uid()) OR created_by_user_id = auth.uid());

CREATE POLICY "Managers can update projects"
  ON public.projects FOR UPDATE
  USING (is_manager(auth.uid()));

CREATE POLICY "Project members can update assigned projects"
  ON public.projects FOR UPDATE
  USING (
    ux_po_user_id = auth.uid() OR
    dev_user_id = auth.uid() OR
    treinamento_user_id = auth.uid() OR
    head_user_id = auth.uid()
  );

CREATE POLICY "Admins can delete projects"
  ON public.projects FOR DELETE
  USING (is_admin(auth.uid()));

-- 11. RLS for project_phases
CREATE POLICY "Users can view phases of accessible projects"
  ON public.project_phases FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_phases.project_id
    AND (
      is_manager(auth.uid()) OR
      p.created_by_user_id = auth.uid() OR
      p.ux_po_user_id = auth.uid() OR
      p.dev_user_id = auth.uid() OR
      p.treinamento_user_id = auth.uid() OR
      p.head_user_id = auth.uid()
    )
  ));

CREATE POLICY "Managers can insert phases"
  ON public.project_phases FOR INSERT
  WITH CHECK (is_manager(auth.uid()) OR is_project_member(auth.uid()));

CREATE POLICY "Managers and members can update phases"
  ON public.project_phases FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_phases.project_id
    AND (
      is_manager(auth.uid()) OR
      p.ux_po_user_id = auth.uid() OR
      p.dev_user_id = auth.uid() OR
      p.treinamento_user_id = auth.uid() OR
      p.head_user_id = auth.uid()
    )
  ));

CREATE POLICY "Admins can delete phases"
  ON public.project_phases FOR DELETE
  USING (is_admin(auth.uid()));

-- 12. RLS for project_status_transitions
CREATE POLICY "Users can view transitions of accessible projects"
  ON public.project_status_transitions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_status_transitions.project_id
    AND (
      is_manager(auth.uid()) OR
      p.created_by_user_id = auth.uid() OR
      p.ux_po_user_id = auth.uid() OR
      p.dev_user_id = auth.uid() OR
      p.treinamento_user_id = auth.uid() OR
      p.head_user_id = auth.uid()
    )
  ));

CREATE POLICY "Authenticated users can insert transitions"
  ON public.project_status_transitions FOR INSERT
  WITH CHECK (is_manager(auth.uid()) OR is_project_member(auth.uid()));

CREATE POLICY "Managers can update transitions"
  ON public.project_status_transitions FOR UPDATE
  USING (is_manager(auth.uid()) OR is_project_member(auth.uid()));

-- 13. RLS for project_activity_logs
CREATE POLICY "Users can view logs of accessible projects"
  ON public.project_activity_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_activity_logs.project_id
    AND (
      is_manager(auth.uid()) OR
      p.created_by_user_id = auth.uid() OR
      p.ux_po_user_id = auth.uid() OR
      p.dev_user_id = auth.uid() OR
      p.treinamento_user_id = auth.uid() OR
      p.head_user_id = auth.uid()
    )
  ));

CREATE POLICY "Authenticated users can insert activity logs"
  ON public.project_activity_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());
