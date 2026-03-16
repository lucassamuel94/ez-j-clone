
-- Drop and recreate INSERT policy for project_activity_logs to include all project stakeholders
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.project_activity_logs;

CREATE POLICY "Authenticated users can insert activity logs"
ON public.project_activity_logs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    is_manager(auth.uid())
    OR is_project_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_activity_logs.project_id
        AND (
          p.created_by_user_id = auth.uid()
          OR p.closer_user_id = auth.uid()
          OR p.sdr_user_id = auth.uid()
          OR p.ux_po_user_id = auth.uid()
          OR p.dev_user_id = auth.uid()
          OR p.treinamento_user_id = auth.uid()
          OR p.head_user_id = auth.uid()
        )
    )
  )
);
