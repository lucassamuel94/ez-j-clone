
-- 1. Drop the old trigger that auto-stamps sqo_approved_at based on SQO field validation
DROP TRIGGER IF EXISTS trg_stamp_sqo_approval ON public.leads;
DROP FUNCTION IF EXISTS public.stamp_sqo_approval();

-- 2. Create new trigger function on opportunities table
CREATE OR REPLACE FUNCTION public.stamp_sqo_on_stage_advance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when stage changes FROM 'Demonstração' to something else
  IF OLD.stage = 'Demonstração'
     AND NEW.stage IS DISTINCT FROM 'Demonstração'
     AND NEW.stage <> 'Perdido'
     AND NEW.returned_to_sdr IS NOT TRUE
     AND NEW.lead_id IS NOT NULL
  THEN
    -- Only stamp if lead doesn't already have sqo_approved_at (immutable, once in lifetime)
    UPDATE public.leads
    SET sqo_approved_at = now()
    WHERE id = NEW.lead_id
      AND sqo_approved_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Attach trigger to opportunities table
CREATE TRIGGER trg_stamp_sqo_on_stage_advance
  AFTER UPDATE ON public.opportunities
  FOR EACH ROW
  WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
  EXECUTE FUNCTION public.stamp_sqo_on_stage_advance();

-- 4. Reset ALL sqo_approved_at (old trigger data is unreliable)
UPDATE public.leads SET sqo_approved_at = NULL WHERE sqo_approved_at IS NOT NULL;

-- 5. Backfill from activity logs: find the FIRST time a closer moved stage FROM Demonstração
WITH first_sqo_event AS (
  SELECT DISTINCT ON (la.lead_id)
    la.lead_id,
    la.created_at AS sqo_at
  FROM public.lead_activity_logs la
  WHERE la.action_type = 'field_updated'
    AND la.field_name = 'closer_stage'
    AND la.old_value = 'Demonstração'
    AND la.new_value IS NOT NULL
    AND la.new_value <> 'Perdido'
    AND la.lead_id IS NOT NULL
  ORDER BY la.lead_id, la.created_at ASC
)
UPDATE public.leads l
SET sqo_approved_at = f.sqo_at
FROM first_sqo_event f
WHERE l.id = f.lead_id;
