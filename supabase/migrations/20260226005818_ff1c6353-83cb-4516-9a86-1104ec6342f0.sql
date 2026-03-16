
-- Update RLS policy for project members to include ativacao_user_id
DROP POLICY IF EXISTS "Project members can view assigned projects" ON public.projects;
CREATE POLICY "Project members can view assigned projects" ON public.projects
  FOR SELECT TO authenticated
  USING (
    ((ux_po_user_id = auth.uid()) OR (dev_user_id = auth.uid()) OR (treinamento_user_id = auth.uid()) OR (head_user_id = auth.uid()) OR (ativacao_user_id = auth.uid()))
    AND (archived = false)
  );

DROP POLICY IF EXISTS "Project members can update assigned projects" ON public.projects;
CREATE POLICY "Project members can update assigned projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (
    (ux_po_user_id = auth.uid()) OR (dev_user_id = auth.uid()) OR (treinamento_user_id = auth.uid()) OR (head_user_id = auth.uid()) OR (ativacao_user_id = auth.uid())
  );
