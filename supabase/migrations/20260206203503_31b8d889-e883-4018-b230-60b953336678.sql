-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view notes on accessible leads" ON public.lead_notes;

-- Create a more permissive SELECT policy that matches leads policy
CREATE POLICY "Users can view notes on accessible leads"
ON public.lead_notes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_notes.lead_id
    AND (
      is_manager(auth.uid())
      OR leads.owner_user_id = auth.uid()
      OR leads.owner_user_id IS NULL
    )
  )
);