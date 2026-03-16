
CREATE OR REPLACE FUNCTION public.update_proposal_status(p_proposal_id uuid, p_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('accepted', 'rejected') THEN
    RETURN false;
  END IF;

  UPDATE proposals
  SET status = p_status
  WHERE id = p_proposal_id
    AND status NOT IN ('accepted', 'rejected');

  RETURN FOUND;
END;
$$;
