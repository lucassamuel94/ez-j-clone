
-- Allow lead owners to update their own notes
CREATE POLICY "Lead owners can update notes"
ON public.lead_notes
FOR UPDATE
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_notes.lead_id
    AND leads.owner_user_id = auth.uid()
  )
);

-- Allow lead owners to delete their own notes
CREATE POLICY "Lead owners can delete notes"
ON public.lead_notes
FOR DELETE
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_notes.lead_id
    AND leads.owner_user_id = auth.uid()
  )
);
