
-- Fix SELECT policy on lead_activity_logs to include closers
DROP POLICY IF EXISTS "Users can view activity logs on accessible leads" ON public.lead_activity_logs;

CREATE POLICY "Users can view activity logs on accessible leads"
ON public.lead_activity_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_activity_logs.lead_id
    AND (
      leads.owner_user_id = auth.uid()
      OR is_manager(auth.uid())
      OR EXISTS (
        SELECT 1 FROM opportunities
        WHERE opportunities.lead_id = leads.id
        AND opportunities.assigned_to_user_id = auth.uid()
      )
    )
  )
);
