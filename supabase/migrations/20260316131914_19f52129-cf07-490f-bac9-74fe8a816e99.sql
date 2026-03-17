DROP POLICY IF EXISTS "Closers can view own projects" ON public.projects;

CREATE POLICY "Closers can view own projects" ON public.projects
  FOR SELECT USING (
    (closer_user_id = auth.uid() OR sdr_user_id = auth.uid() OR created_by_user_id = auth.uid())
    AND archived = false
  );