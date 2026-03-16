
DROP POLICY "Users can view phases of accessible projects" ON public.project_phases;

CREATE POLICY "Users can view phases of accessible projects"
  ON public.project_phases FOR SELECT
  USING (
    is_project_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_phases.project_id
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
