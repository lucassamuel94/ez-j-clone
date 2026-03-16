
-- Drop the restrictive insert policy
DROP POLICY "Managers and members can insert tasks" ON public.project_tasks;

-- Create a new policy: any authenticated user can create tasks they own
CREATE POLICY "Authenticated users can insert own tasks"
ON public.project_tasks
FOR INSERT
WITH CHECK (created_by_user_id = auth.uid());

-- Also allow users to view their own tasks (assigned or created)
CREATE POLICY "Users can view own tasks"
ON public.project_tasks
FOR SELECT
USING (created_by_user_id = auth.uid() OR assigned_user_id = auth.uid());

-- Allow users to update their own created tasks
CREATE POLICY "Users can update own tasks"
ON public.project_tasks
FOR UPDATE
USING (created_by_user_id = auth.uid() OR assigned_user_id = auth.uid());
