-- Allow closers to view leads that have opportunities assigned to them
CREATE POLICY "Closers can view leads with assigned opportunities"
ON public.leads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE opportunities.lead_id = leads.id
      AND opportunities.assigned_to_user_id = auth.uid()
  )
);