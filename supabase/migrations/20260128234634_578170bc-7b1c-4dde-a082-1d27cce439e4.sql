
-- Drop existing restrictive policies for lead_notes
DROP POLICY IF EXISTS "Users can create notes" ON public.lead_notes;
DROP POLICY IF EXISTS "Users can view notes on accessible leads" ON public.lead_notes;

-- Create permissive policies for testing (allow anonymous access)
CREATE POLICY "Anyone can create notes for testing"
ON public.lead_notes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view notes for testing"
ON public.lead_notes FOR SELECT
USING (true);

-- Drop existing restrictive policies for interactions
DROP POLICY IF EXISTS "Users can create interactions" ON public.interactions;
DROP POLICY IF EXISTS "Users can view interactions on accessible leads" ON public.interactions;

-- Create permissive policies for testing
CREATE POLICY "Anyone can create interactions for testing"
ON public.interactions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view interactions for testing"
ON public.interactions FOR SELECT
USING (true);

-- Also make user_id nullable in lead_notes and interactions for anonymous testing
ALTER TABLE public.lead_notes ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.interactions ALTER COLUMN user_id DROP NOT NULL;
