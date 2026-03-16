
-- Drop and recreate the SELECT policy for lead_notes to include closers
DROP POLICY IF EXISTS "Users can view notes on accessible leads" ON public.lead_notes;

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
      OR EXISTS (
        SELECT 1 FROM opportunities
        WHERE opportunities.lead_id = leads.id
        AND opportunities.assigned_to_user_id = auth.uid()
      )
    )
  )
);

-- Also update INSERT policy to allow closers with opportunities on the lead
DROP POLICY IF EXISTS "Authenticated users can create notes" ON public.lead_notes;

CREATE POLICY "Authenticated users can create notes"
ON public.lead_notes
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_notes.lead_id
    AND (
      is_manager(auth.uid())
      OR leads.owner_user_id = auth.uid()
      OR leads.owner_user_id IS NULL
      OR EXISTS (
        SELECT 1 FROM opportunities
        WHERE opportunities.lead_id = leads.id
        AND opportunities.assigned_to_user_id = auth.uid()
      )
    )
  )
);
