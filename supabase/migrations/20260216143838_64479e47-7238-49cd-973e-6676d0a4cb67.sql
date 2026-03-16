
-- Step 1: Create accept_invitation function
CREATE OR REPLACE FUNCTION public.accept_invitation(invite_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_user_email TEXT;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF v_user_email IS NULL THEN RETURN false; END IF;

  SELECT * INTO v_invitation FROM user_invitations
  WHERE id = invite_id AND accepted_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN RETURN false; END IF;
  IF lower(v_invitation.email) != lower(v_user_email) THEN RETURN false; END IF;

  INSERT INTO user_roles (user_id, role)
  VALUES (auth.uid(), v_invitation.role)
  ON CONFLICT (user_id, role) DO UPDATE SET role = EXCLUDED.role;

  UPDATE user_invitations SET accepted_at = now() WHERE id = invite_id;
  RETURN true;
END;
$$;

-- Step 2: Fix Laura immediately
INSERT INTO user_roles (user_id, role)
VALUES ('8d514313-e8b1-4a00-8d1f-22fca08aa742', 'treinamento')
ON CONFLICT (user_id, role) DO UPDATE SET role = EXCLUDED.role;

UPDATE user_invitations SET accepted_at = now()
WHERE id = '2f5a9dac-0275-4af4-b5e7-45760490fed8';
