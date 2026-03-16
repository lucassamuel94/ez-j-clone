-- Create function to check if user is manager or admin
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager')
  )
$$;

-- Update RLS policies for user_roles to allow managers to view
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins and managers can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_manager(auth.uid()));

-- Update RLS policies for user_invitations to allow managers to view
DROP POLICY IF EXISTS "Admins can view all invitations" ON public.user_invitations;
CREATE POLICY "Admins and managers can view all invitations"
ON public.user_invitations
FOR SELECT
USING (public.is_manager(auth.uid()));