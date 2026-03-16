
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view leads based on role" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads based on role" ON public.leads;

-- Recreate policies: Admins/Managers see ALL leads, SDRs see ONLY their own
CREATE POLICY "Users can view leads based on role" ON public.leads
FOR SELECT USING (
  is_manager(auth.uid()) OR owner_user_id = auth.uid()
);

CREATE POLICY "Users can update leads based on role" ON public.leads
FOR UPDATE USING (
  is_manager(auth.uid()) OR owner_user_id = auth.uid()
);
