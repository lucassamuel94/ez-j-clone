
-- Allow project role users (ux_po, dev_chatbot, treinamento, head_pos_venda) to view all projects
CREATE POLICY "Project role users can view all projects"
  ON public.projects FOR SELECT
  USING (is_project_member(auth.uid()));
