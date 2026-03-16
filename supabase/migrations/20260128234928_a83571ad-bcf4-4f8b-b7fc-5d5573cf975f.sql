
-- Restore proper RLS policies for lead_notes
DROP POLICY IF EXISTS "Anyone can create notes for testing" ON public.lead_notes;
DROP POLICY IF EXISTS "Anyone can view notes for testing" ON public.lead_notes;

CREATE POLICY "Users can create notes"
ON public.lead_notes FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view notes on accessible leads"
ON public.lead_notes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_notes.lead_id
    AND (leads.owner_user_id = auth.uid() OR leads.owner_user_id IS NULL)
  )
);

-- Restore proper RLS policies for interactions
DROP POLICY IF EXISTS "Anyone can create interactions for testing" ON public.interactions;
DROP POLICY IF EXISTS "Anyone can view interactions for testing" ON public.interactions;

CREATE POLICY "Users can create interactions"
ON public.interactions FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view interactions on accessible leads"
ON public.interactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = interactions.lead_id
    AND (leads.owner_user_id = auth.uid() OR leads.owner_user_id IS NULL)
  )
);

-- Restore NOT NULL constraint on user_id (will be done after data cleanup)
-- ALTER TABLE public.lead_notes ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.interactions ALTER COLUMN user_id SET NOT NULL;
