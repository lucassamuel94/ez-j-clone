DROP POLICY "Admins can delete proposals" ON public.proposals;

CREATE POLICY "Creator or admin can delete proposals" ON public.proposals
FOR DELETE USING (
  created_by_user_id = auth.uid() OR is_admin(auth.uid())
);