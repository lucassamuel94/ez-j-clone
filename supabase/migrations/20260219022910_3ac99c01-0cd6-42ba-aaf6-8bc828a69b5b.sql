-- Add archived column to projects
ALTER TABLE public.projects ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Drop non-admin/non-manager SELECT policies that need to filter archived
DROP POLICY IF EXISTS "Closers can view own projects" ON public.projects;
DROP POLICY IF EXISTS "Project members can view assigned projects" ON public.projects;
DROP POLICY IF EXISTS "Project role users can view all projects" ON public.projects;

-- Recreate with archived filter
CREATE POLICY "Closers can view own projects"
ON public.projects FOR SELECT
USING ((created_by_user_id = auth.uid()) AND (archived = false));

CREATE POLICY "Project members can view assigned projects"
ON public.projects FOR SELECT
USING (
  ((ux_po_user_id = auth.uid()) OR (dev_user_id = auth.uid()) OR (treinamento_user_id = auth.uid()) OR (head_user_id = auth.uid()))
  AND (archived = false)
);

CREATE POLICY "Project role users can view all projects"
ON public.projects FOR SELECT
USING (is_project_member(auth.uid()) AND (archived = false));
