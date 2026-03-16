-- Allow all authenticated users to view team goals (target_user_id IS NULL)
CREATE POLICY "Users can view team goals"
ON public.goals
FOR SELECT
USING (target_user_id IS NULL);