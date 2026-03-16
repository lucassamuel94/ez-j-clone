
-- 1. Fix project_activity_logs SELECT: add closer_user_id and sdr_user_id
DROP POLICY IF EXISTS "Users can view logs of accessible projects" ON public.project_activity_logs;
CREATE POLICY "Users can view logs of accessible projects"
ON public.project_activity_logs FOR SELECT TO authenticated
USING (
  is_project_member(auth.uid())
  OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_activity_logs.project_id
      AND (
        is_manager(auth.uid())
        OR p.created_by_user_id = auth.uid()
        OR p.ux_po_user_id = auth.uid()
        OR p.dev_user_id = auth.uid()
        OR p.treinamento_user_id = auth.uid()
        OR p.head_user_id = auth.uid()
        OR p.closer_user_id = auth.uid()
        OR p.sdr_user_id = auth.uid()
      )
  )
);

-- 2. Fix project_attachments SELECT: add closer_user_id and sdr_user_id
DROP POLICY IF EXISTS "Users can view attachments of accessible projects" ON public.project_attachments;
CREATE POLICY "Users can view attachments of accessible projects"
ON public.project_attachments FOR SELECT TO authenticated
USING (
  is_project_member(auth.uid())
  OR EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_attachments.project_id
      AND (
        is_manager(auth.uid())
        OR p.created_by_user_id = auth.uid()
        OR p.ux_po_user_id = auth.uid()
        OR p.dev_user_id = auth.uid()
        OR p.treinamento_user_id = auth.uid()
        OR p.head_user_id = auth.uid()
        OR p.closer_user_id = auth.uid()
        OR p.sdr_user_id = auth.uid()
      )
  )
);

-- 3. Add UPDATE policy for project_integrations
CREATE POLICY "Members and managers can update integrations"
ON public.project_integrations FOR UPDATE TO authenticated
USING (is_project_member(auth.uid()) OR is_manager(auth.uid()));

-- 4. Add soft-delete columns to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deleted_from_status text DEFAULT NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deleted_by_user_id uuid DEFAULT NULL;

-- 5. Index for trash queries
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON public.projects (deleted_at) WHERE deleted_at IS NOT NULL;
