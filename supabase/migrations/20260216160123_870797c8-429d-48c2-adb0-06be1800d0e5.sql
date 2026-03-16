
-- Fix project_tasks SELECT: add is_project_member check
DROP POLICY IF EXISTS "Users can view tasks of accessible projects" ON public.project_tasks;
CREATE POLICY "Users can view tasks of accessible projects"
ON public.project_tasks
FOR SELECT
USING (
  is_project_member(auth.uid()) OR
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

-- Fix project_activity_logs SELECT: add is_project_member check
DROP POLICY IF EXISTS "Users can view logs of accessible projects" ON public.project_activity_logs;
CREATE POLICY "Users can view logs of accessible projects"
ON public.project_activity_logs
FOR SELECT
USING (
  is_project_member(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_activity_logs.project_id
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

-- Fix project_activity_logs INSERT: also allow is_project_member
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.project_activity_logs;
CREATE POLICY "Authenticated users can insert activity logs"
ON public.project_activity_logs
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND (is_manager(auth.uid()) OR is_project_member(auth.uid()))
);
