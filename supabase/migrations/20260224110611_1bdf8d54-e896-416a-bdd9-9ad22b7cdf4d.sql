
-- Add team_id to user_invitations
ALTER TABLE public.user_invitations ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;
 
-- Update accept_invitation to also add user to team
CREATE OR REPLACE FUNCTION public.accept_invitation(_invitation_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  INSERT INTO public.user_roles (user_id, role_id, role)
  VALUES (auth.uid(), _inv.role_id, _inv.role)
  ON CONFLICT (user_id, role) DO UPDATE SET role = EXCLUDED.role, role_id = EXCLUDED.role_id;

  -- Update profile role
  UPDATE public.profiles SET role = _inv.role WHERE id = auth.uid();

  -- Add to team if specified
  IF _inv.team_id IS NOT NULL THEN
    INSERT INTO public.team_members (team_id, user_id)
    VALUES (_inv.team_id, auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mark accepted
  UPDATE public.user_invitations SET accepted_at = now() WHERE id = _invitation_id;
  RETURN true;
END;
$function$;

-- Also update handle_new_user to auto-add to team from invitation
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _default_role_id uuid;
  _invitation record;
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email);

  SELECT role, role_id, team_id INTO _invitation
  FROM public.user_invitations WHERE email = NEW.email AND accepted_at IS NULL AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;

  IF _invitation.role IS NOT NULL THEN
    IF _invitation.role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id, role) VALUES (NEW.id, _invitation.role_id, _invitation.role);
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _invitation.role);
    END IF;
    
    -- Add to team if specified
    IF _invitation.team_id IS NOT NULL THEN
      INSERT INTO public.team_members (team_id, user_id) VALUES (_invitation.team_id, NEW.id)
      ON CONFLICT DO NOTHING;
    END IF;
    
    UPDATE public.user_invitations SET accepted_at = now() WHERE email = NEW.email AND accepted_at IS NULL;
  ELSE
    SELECT id INTO _default_role_id FROM public.roles WHERE is_default = true LIMIT 1;
    INSERT INTO public.user_roles (user_id, role_id, role) VALUES (NEW.id, _default_role_id, 'sdr');
  END IF;
  RETURN NEW;
END;
$function$;
