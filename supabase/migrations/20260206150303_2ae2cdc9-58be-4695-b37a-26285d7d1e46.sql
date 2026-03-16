-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;

-- Create new policy: Admins/Managers see all, SDRs see own + unassigned
CREATE POLICY "Users can view leads based on role"
ON public.leads
FOR SELECT
USING (
  is_manager(auth.uid()) 
  OR owner_user_id = auth.uid() 
  OR owner_user_id IS NULL
);

-- Also update the UPDATE policy to allow managers to update any lead
DROP POLICY IF EXISTS "Users can update own leads" ON public.leads;

CREATE POLICY "Users can update leads based on role"
ON public.leads
FOR UPDATE
USING (
  is_manager(auth.uid()) 
  OR owner_user_id = auth.uid() 
  OR owner_user_id IS NULL
);