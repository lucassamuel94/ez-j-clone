-- Allow closers to update leads they have assigned opportunities for
DROP POLICY IF EXISTS "Users can update leads based on role" ON public.leads;

CREATE POLICY "Users can update leads based on role"
ON public.leads
FOR UPDATE
USING (
  is_manager(auth.uid()) 
  OR (owner_user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.opportunities
    WHERE opportunities.lead_id = leads.id
    AND opportunities.assigned_to_user_id = auth.uid()
  )
);