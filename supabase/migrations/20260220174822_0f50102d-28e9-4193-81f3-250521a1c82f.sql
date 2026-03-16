
-- Table: project_deliveries
CREATE TABLE public.project_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES auth.users(id),
  admin_link text NOT NULL,
  has_integration boolean NOT NULL DEFAULT false,
  is_new_integration boolean NOT NULL DEFAULT false,
  observations text,
  ux_responsible text,
  project_type_label text,
  uses_gpt boolean NOT NULL DEFAULT false,
  version text,
  complexity_level text,
  closer_name text,
  company_name text,
  cnpj text,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members and managers can view deliveries"
  ON public.project_deliveries FOR SELECT
  USING (is_project_member(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "Members and managers can insert deliveries"
  ON public.project_deliveries FOR INSERT
  WITH CHECK (submitted_by = auth.uid() AND (is_project_member(auth.uid()) OR is_manager(auth.uid())));

CREATE POLICY "Admins can delete deliveries"
  ON public.project_deliveries FOR DELETE
  USING (is_admin(auth.uid()));

-- Table: project_integrations
CREATE TABLE public.project_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  delivery_id uuid NOT NULL REFERENCES public.project_deliveries(id) ON DELETE CASCADE,
  integration_name text NOT NULL,
  is_new boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members and managers can view integrations"
  ON public.project_integrations FOR SELECT
  USING (is_project_member(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "Members and managers can insert integrations"
  ON public.project_integrations FOR INSERT
  WITH CHECK (is_project_member(auth.uid()) OR is_manager(auth.uid()));

CREATE POLICY "Admins can delete integrations"
  ON public.project_integrations FOR DELETE
  USING (is_admin(auth.uid()));
