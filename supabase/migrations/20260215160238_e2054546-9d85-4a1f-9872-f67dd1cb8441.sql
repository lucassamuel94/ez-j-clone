
-- Add active objection and expected close date to opportunities
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS active_objection text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS expected_close_date date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS decision_maker_identified boolean DEFAULT false;
