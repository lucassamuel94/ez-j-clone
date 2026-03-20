CREATE OR REPLACE FUNCTION public.auto_win_on_proposal_accepted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    UPDATE opportunities
    SET stage = 'Ganho',
        won_at = COALESCE(won_at, NOW()),
        deal_value = COALESCE(NULLIF(deal_value, 0), NEW.setup_total)
    WHERE id = NEW.opportunity_id
      AND stage <> 'Ganho';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_proposal_accepted
AFTER UPDATE ON proposals
FOR EACH ROW
EXECUTE FUNCTION auto_win_on_proposal_accepted();