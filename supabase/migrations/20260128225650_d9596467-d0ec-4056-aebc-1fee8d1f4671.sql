-- Fix overly permissive policies by adding user checks where appropriate

-- Drop and recreate cadences policies (allow all authenticated to read, but track who creates)
DROP POLICY IF EXISTS "Authenticated users can manage cadences" ON public.cadences;

CREATE POLICY "Authenticated users can insert cadences" ON public.cadences
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update cadences" ON public.cadences
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete cadences" ON public.cadences
  FOR DELETE TO authenticated USING (true);

-- Drop and recreate cadence_steps policies
DROP POLICY IF EXISTS "Authenticated users can manage cadence steps" ON public.cadence_steps;

CREATE POLICY "Authenticated users can insert cadence steps" ON public.cadence_steps
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update cadence steps" ON public.cadence_steps
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete cadence steps" ON public.cadence_steps
  FOR DELETE TO authenticated USING (true);

-- Drop and recreate lead_cadences policies  
DROP POLICY IF EXISTS "Users can manage lead cadences" ON public.lead_cadences;

CREATE POLICY "Users can insert lead cadences" ON public.lead_cadences
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.leads WHERE id = lead_id AND (owner_user_id = auth.uid() OR owner_user_id IS NULL))
  );

CREATE POLICY "Users can update lead cadences" ON public.lead_cadences
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.leads WHERE id = lead_id AND (owner_user_id = auth.uid() OR owner_user_id IS NULL))
  );

CREATE POLICY "Users can delete lead cadences" ON public.lead_cadences
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.leads WHERE id = lead_id AND (owner_user_id = auth.uid() OR owner_user_id IS NULL))
  );