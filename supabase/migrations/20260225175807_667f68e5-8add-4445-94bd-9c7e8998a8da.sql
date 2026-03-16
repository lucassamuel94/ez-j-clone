-- Fix DELETE policy: allow assigned users to delete tasks assigned to them
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.project_tasks;
CREATE POLICY "Users can delete own tasks"
  ON public.project_tasks
  FOR DELETE
  USING ((created_by_user_id = auth.uid()) OR (assigned_user_id = auth.uid()));
