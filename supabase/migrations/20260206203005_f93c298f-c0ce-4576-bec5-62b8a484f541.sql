-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can create notes" ON public.lead_notes;

-- Create a new policy that allows authenticated users to create notes
-- The user_id will be set to auth.uid() automatically or can be null
CREATE POLICY "Authenticated users can create notes"
ON public.lead_notes
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() OR user_id IS NULL
);