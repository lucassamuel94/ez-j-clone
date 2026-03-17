-- Fix lock_sqo_approval trigger: column is assigned_to_user_id, not assigned_to
-- The previous migration (20260313165921) referenced a non-existent column 'assigned_to',
-- causing the trigger to fail with a SQL error on every SQO approval attempt.
CREATE OR REPLACE FUNCTION public.lock_sqo_approval()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  _lead RECORD;
BEGIN
  IF OLD.stage = 'Demonstração'
     AND NEW.stage IS DISTINCT FROM 'Demonstração'
     AND NEW.stage <> 'Perdido'
     AND NEW.returned_to_sdr IS NOT TRUE
     AND NEW.lead_id IS NOT NULL
  THEN
    SELECT * INTO _lead FROM public.leads WHERE id = NEW.lead_id;
    IF _lead.sqo_approved_at IS NULL
       AND public.is_sqo_approved(
         _lead.sqo_pain_category, _lead.sqo_pain_clear,
         _lead.sqo_pain_financial_impact, _lead.sqo_urgency,
         _lead.sqo_budget, _lead.sqo_decision_maker, _lead.sqo_icp_fit
       )
    THEN
      UPDATE public.leads
      SET sqo_approved_at = now(),
          sqo_approved_by = (SELECT assigned_to_user_id FROM public.opportunities WHERE id = NEW.id)
      WHERE id = NEW.lead_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
