-- Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN email text;

-- Populate email from auth.users
UPDATE public.profiles
SET email = u.email
FROM auth.users u
WHERE profiles.id = u.id;

-- Update handle_new_user to also store email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), NEW.email, 'sdr');
  RETURN NEW;
END;
$function$;