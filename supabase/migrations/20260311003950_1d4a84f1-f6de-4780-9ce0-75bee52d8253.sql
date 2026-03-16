
-- Sync existing Google OAuth avatars to profiles where avatar_url is null
UPDATE public.profiles p
SET avatar_url = au.raw_user_meta_data->>'avatar_url'
FROM auth.users au
WHERE au.id = p.id
  AND p.avatar_url IS NULL
  AND au.raw_user_meta_data->>'avatar_url' IS NOT NULL;

-- Update handle_new_user to also store avatar_url from Google OAuth
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
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  SELECT role, role_id, team_id INTO _invitation
  FROM public.user_invitations WHERE email = NEW.email AND accepted_at IS NULL AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1;

  IF _invitation.role IS NOT NULL THEN
    IF _invitation.role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id, role) VALUES (NEW.id, _invitation.role_id, _invitation.role);
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _invitation.role);
    END IF;
    
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
