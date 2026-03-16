
-- Drop the existing update policy and recreate with explicit WITH CHECK
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
)
WITH CHECK (
  is_manager(auth.uid()) 
  OR owner_user_id = auth.uid() 
  OR owner_user_id IS NULL 
  OR EXISTS (
    SELECT 1 FROM opportunities 
    WHERE opportunities.lead_id = leads.id 
    AND opportunities.assigned_to_user_id = auth.uid()
  )
  -- Allow SDR to transfer: old owner was auth.uid()
  OR EXISTS (
    SELECT 1 FROM leads AS old_lead
    WHERE old_lead.id = leads.id 
    AND old_lead.owner_user_id = auth.uid()
  )
);
