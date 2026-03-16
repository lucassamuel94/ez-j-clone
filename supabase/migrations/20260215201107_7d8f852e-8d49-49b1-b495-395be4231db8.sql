
-- Create project_tasks table
CREATE TABLE public.project_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  assigned_user_id UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pendente',
  notify_before TEXT DEFAULT 'none',
  created_by_user_id UUID NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- Policies: view tasks of accessible projects
CREATE POLICY "Users can view tasks of accessible projects"
ON public.project_tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_tasks.project_id
    AND (
      is_manager(auth.uid())
      OR p.created_by_user_id = auth.uid()
      OR p.ux_po_user_id = auth.uid()
      OR p.dev_user_id = auth.uid()
      OR p.treinamento_user_id = auth.uid()
      OR p.head_user_id = auth.uid()
    )
  )
);

-- Insert: managers and project members
CREATE POLICY "Managers and members can insert tasks"
ON public.project_tasks
FOR INSERT
WITH CHECK (
  created_by_user_id = auth.uid()
  AND (is_manager(auth.uid()) OR is_project_member(auth.uid()))
);

-- Update: managers and project members
CREATE POLICY "Managers and members can update tasks"
ON public.project_tasks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_tasks.project_id
    AND (
      is_manager(auth.uid())
      OR p.ux_po_user_id = auth.uid()
      OR p.dev_user_id = auth.uid()
      OR p.treinamento_user_id = auth.uid()
      OR p.head_user_id = auth.uid()
    )
  )
);

-- Delete: admins only
CREATE POLICY "Admins can delete tasks"
ON public.project_tasks
FOR DELETE
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_project_tasks_updated_at
BEFORE UPDATE ON public.project_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
