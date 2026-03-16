
-- Drop e recriar accept_invitation com tipo correto
DROP FUNCTION IF EXISTS public.accept_invitation(uuid);

CREATE OR REPLACE FUNCTION public.accept_invitation(_invitation_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv record;
  _user_email text;
BEGIN
  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();
  IF _user_email IS NULL THEN RETURN false; END IF;

  SELECT * INTO _inv FROM public.user_invitations
  WHERE id = _invitation_id AND accepted_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN RETURN false; END IF;
  IF lower(_inv.email) != lower(_user_email) THEN RETURN false; END IF;

  -- Upsert user_roles with role_id
  INSERT INTO public.user_roles (user_id, role, role_id)
  VALUES (auth.uid(), _inv.role, _inv.role_id)
  ON CONFLICT (user_id, role) DO UPDATE SET role = EXCLUDED.role, role_id = EXCLUDED.role_id;

  -- Update profile role
  UPDATE public.profiles SET role = _inv.role WHERE id = auth.uid();

  -- Mark accepted
  UPDATE public.user_invitations SET accepted_at = now() WHERE id = _invitation_id;
  RETURN true;
END;
$$;
