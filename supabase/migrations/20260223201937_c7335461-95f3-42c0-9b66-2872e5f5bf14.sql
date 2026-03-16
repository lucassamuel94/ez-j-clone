
-- Fix: Allow project creators (closers) to insert project phases
DROP POLICY IF EXISTS "Managers can insert phases" ON public.project_phases;
CREATE POLICY "Managers and creators can insert phases"
ON public.project_phases FOR INSERT
WITH CHECK (
  is_manager(auth.uid()) 
  OR is_project_member(auth.uid())
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_phases.project_id AND p.created_by_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_phases.project_id AND (p.closer_user_id = auth.uid() OR p.sdr_user_id = auth.uid())
  )
);

-- Fix: Allow project creators (closers) to insert transitions
DROP POLICY IF EXISTS "Authenticated users can insert transitions" ON public.project_status_transitions;
CREATE POLICY "Authenticated users can insert transitions"
ON public.project_status_transitions FOR INSERT
WITH CHECK (
  is_manager(auth.uid()) 
  OR is_project_member(auth.uid())
  OR EXISTS (
    SELECT 1 FROM projects p WHERE p.id = project_status_transitions.project_id AND (p.created_by_user_id = auth.uid() OR p.closer_user_id = auth.uid() OR p.sdr_user_id = auth.uid())
  )
);

-- Fix: Allow project creators (closers) to insert activity logs
DROP POLICY IF EXISTS "Authenticated users can insert activity logs" ON public.project_activity_logs;
CREATE POLICY "Authenticated users can insert activity logs"
ON public.project_activity_logs FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  AND (
    is_manager(auth.uid()) 
    OR is_project_member(auth.uid())
    OR EXISTS (
      SELECT 1 FROM projects p WHERE p.id = project_activity_logs.project_id AND (p.created_by_user_id = auth.uid() OR p.closer_user_id = auth.uid() OR p.sdr_user_id = auth.uid())
    )
  )
);

-- Also ensure closers can insert projects (created_by_user_id check should work but let's be explicit)
DROP POLICY IF EXISTS "Managers can insert projects" ON public.projects;
CREATE POLICY "Managers and closers can insert projects"
ON public.projects FOR INSERT
WITH CHECK (
  is_manager(auth.uid()) 
  OR is_project_member(auth.uid()) 
  OR created_by_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('closer', 'sdr')
  )
);
