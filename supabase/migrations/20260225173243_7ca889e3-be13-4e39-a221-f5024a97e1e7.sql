
-- SELECT: ver tarefas das oportunidades/leads do usuario
CREATE POLICY "Users can view tasks of their opportunities or leads"
ON public.project_tasks FOR SELECT TO authenticated
USING (
  (opportunity_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM opportunities o
    WHERE o.id = project_tasks.opportunity_id
      AND (o.assigned_to_user_id = auth.uid() OR o.sdr_user_id = auth.uid())
  ))
  OR
  (lead_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = project_tasks.lead_id
      AND l.owner_user_id = auth.uid()
  ))
);

-- UPDATE: editar/resolver tarefas das oportunidades/leads do usuario
CREATE POLICY "Users can update tasks of their opportunities or leads"
ON public.project_tasks FOR UPDATE TO authenticated
USING (
  (opportunity_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM opportunities o
    WHERE o.id = project_tasks.opportunity_id
      AND (o.assigned_to_user_id = auth.uid() OR o.sdr_user_id = auth.uid())
  ))
  OR
  (lead_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = project_tasks.lead_id
      AND l.owner_user_id = auth.uid()
  ))
);

-- DELETE: usuarios podem deletar tarefas que criaram
CREATE POLICY "Users can delete own tasks"
ON public.project_tasks FOR DELETE TO authenticated
USING (created_by_user_id = auth.uid());
