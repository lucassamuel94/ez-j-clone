
CREATE OR REPLACE FUNCTION public.transfer_opportunity_owner(p_opportunity_id uuid, p_new_owner_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Allow if caller is current closer, creator, or manager/admin
  IF NOT EXISTS (
    SELECT 1 FROM opportunities
    WHERE id = p_opportunity_id
    AND (
      assigned_to_user_id = auth.uid()
      OR created_by_user_id = auth.uid()
      OR is_manager(auth.uid())
    )
  ) THEN
    RETURN false;
  END IF;

  UPDATE opportunities
  SET assigned_to_user_id = p_new_owner_id
  WHERE id = p_opportunity_id;

  RETURN true;
END;
$$;
