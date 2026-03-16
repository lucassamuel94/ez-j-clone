
-- Make behavioral_score nullable to distinguish "never calculated" (NULL) from "calculated as 0"
ALTER TABLE public.leads ALTER COLUMN behavioral_score DROP NOT NULL;
ALTER TABLE public.leads ALTER COLUMN behavioral_score DROP DEFAULT;

-- Set existing leads with score=0 that were never calculated to NULL
UPDATE public.leads 
SET behavioral_score = NULL 
WHERE behavioral_score = 0 
  AND last_score_calculated_at IS NULL;
