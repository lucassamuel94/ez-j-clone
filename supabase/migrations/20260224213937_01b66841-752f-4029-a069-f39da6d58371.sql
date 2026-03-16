
-- Drop restrictive delete policy
DROP POLICY "Lead owners can delete notes" ON public.lead_notes;

-- New policy: users can delete their own notes on accessible leads (owner, manager, or closer)
CREATE POLICY "Users can delete own notes on accessible leads"
ON public.lead_notes FOR DELETE
USING (
  (user_id = auth.uid()) AND (
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
  )
);
