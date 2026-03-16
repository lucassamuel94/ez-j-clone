-- Fix: Allow project-role users to update ANY project (not just ones they're assigned to)
-- Drop the restrictive policy
DROP POLICY IF EXISTS "Project members can update assigned projects" ON public.projects;

-- Recreate with is_project_member check (covers head_pos_venda, ux_po, dev_chatbot, treinamento)
CREATE POLICY "Project members can update assigned projects" ON public.projects
FOR UPDATE USING (
  is_project_member(auth.uid())
  OR ux_po_user_id = auth.uid()
  OR dev_user_id = auth.uid()
  OR treinamento_user_id = auth.uid()
  OR head_user_id = auth.uid()
  OR ativacao_user_id = auth.uid()
);