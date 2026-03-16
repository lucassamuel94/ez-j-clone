
-- Add won_at column
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS won_at timestamptz DEFAULT NULL;

-- Backfill
UPDATE public.opportunities SET won_at = updated_at WHERE stage = 'Ganho' AND won_at IS NULL;

-- Trigger function
CREATE OR REPLACE FUNCTION public.set_opportunity_won_at()
RETURNS trigger AS $$
BEGIN
  IF NEW.stage = 'Ganho' AND (OLD.stage IS DISTINCT FROM 'Ganho') THEN
    NEW.won_at := now();
  ELSIF NEW.stage <> 'Ganho' AND OLD.stage = 'Ganho' THEN
    NEW.won_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_opportunity_won_at ON public.opportunities;
CREATE TRIGGER trg_set_opportunity_won_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_opportunity_won_at();
