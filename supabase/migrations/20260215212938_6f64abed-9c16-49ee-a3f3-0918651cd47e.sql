
-- Create project_automations table
CREATE TABLE public.project_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('status_changed', 'phase_changed')),
  trigger_phase text,
  trigger_from_status text,
  trigger_to_status text,
  action_type text NOT NULL CHECK (action_type IN ('webhook', 'change_status', 'change_priority', 'add_comment', 'notify_user')),
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  project_type text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.project_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select automations" ON public.project_automations FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can insert automations" ON public.project_automations FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update automations" ON public.project_automations FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete automations" ON public.project_automations FOR DELETE USING (is_admin(auth.uid()));

CREATE INDEX idx_project_automations_trigger ON public.project_automations (trigger_type, is_active);
CREATE INDEX idx_project_automations_project_type ON public.project_automations (project_type);

-- Create automation_execution_logs table
CREATE TABLE public.automation_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.project_automations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  trigger_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  executed_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view execution logs" ON public.automation_execution_logs FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Authenticated users can insert execution logs" ON public.automation_execution_logs FOR INSERT WITH CHECK (true);

CREATE INDEX idx_automation_logs_automation ON public.automation_execution_logs (automation_id);
CREATE INDEX idx_automation_logs_project ON public.automation_execution_logs (project_id);
