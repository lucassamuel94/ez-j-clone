
-- Add columns for closer loss responsibility and SQO impact
ALTER TABLE public.opportunities 
  ADD COLUMN IF NOT EXISTS lost_responsibility text,
  ADD COLUMN IF NOT EXISTS lost_sqo_impact text;
