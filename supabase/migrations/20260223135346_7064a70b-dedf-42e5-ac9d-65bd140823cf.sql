
-- Allow users to update their own activity logs (comments)
CREATE POLICY "Users can update own activity logs"
ON public.project_activity_logs
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow users to delete their own activity logs (comments)
CREATE POLICY "Users can delete own activity logs"
ON public.project_activity_logs
FOR DELETE
USING (user_id = auth.uid());

-- Allow admins/managers to delete any activity log
CREATE POLICY "Managers can delete activity logs"
ON public.project_activity_logs
FOR DELETE
USING (is_manager(auth.uid()));

-- Allow project members (assigned to the project) to update projects they're assigned to
-- This covers users like SDR, closer, or other team members
CREATE POLICY "Closers can update own projects"
ON public.projects
FOR UPDATE
USING (closer_user_id = auth.uid() OR sdr_user_id = auth.uid() OR created_by_user_id = auth.uid());
