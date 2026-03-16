
-- Update SELECT policy to include unowned leads for all authenticated users
DROP POLICY IF EXISTS "Users can view leads based on role" ON public.leads;
CREATE POLICY "Users can view leads based on role"
ON public.leads
FOR SELECT
USING (
  is_manager(auth.uid())
  OR (owner_user_id = auth.uid())
  OR (owner_user_id IS NULL)
);

-- Update UPDATE policy to allow claiming unowned leads
DROP POLICY IF EXISTS "Users can update leads based on role" ON public.leads;
CREATE POLICY "Users can update leads based on role"
ON public.leads
FOR UPDATE
USING (
  is_manager(auth.uid())
  OR (owner_user_id = auth.uid())
  OR (owner_user_id IS NULL)
  OR (EXISTS (
    SELECT 1 FROM opportunities
    WHERE opportunities.lead_id = leads.id
      AND opportunities.assigned_to_user_id = auth.uid()
  ))
);
