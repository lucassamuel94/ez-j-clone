
-- Create a security definer function for SDR transfer
CREATE OR REPLACE FUNCTION public.transfer_lead_owner(p_lead_id uuid, p_new_owner_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow if caller is current owner, manager, or lead is unassigned
  IF NOT EXISTS (
    SELECT 1 FROM leads
    WHERE id = p_lead_id
    AND (
      owner_user_id = auth.uid()
      OR owner_user_id IS NULL
      OR is_manager(auth.uid())
    )
  ) THEN
    RETURN false;
  END IF;

  UPDATE leads
  SET owner_user_id = p_new_owner_id
  WHERE id = p_lead_id;

  RETURN true;
END;
$$;

-- Fix the WITH CHECK to be simple (same as USING, which is the default behavior)
-- The real fix is the RPC function above, but let's also make the policy correct
DROP POLICY "Users can update leads based on role" ON leads;

CREATE POLICY "Users can update leads based on role"
ON leads FOR UPDATE TO authenticated
USING (
  is_manager(auth.uid()) 
  OR owner_user_id = auth.uid() 
  OR owner_user_id IS NULL 
  OR EXISTS (
    SELECT 1 FROM opportunities 
    WHERE opportunities.lead_id = leads.id 
    AND opportunities.assigned_to_user_id = auth.uid()
  )
);
