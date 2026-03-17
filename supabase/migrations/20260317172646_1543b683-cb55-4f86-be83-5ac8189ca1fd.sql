
-- user_roles: DROP and recreate INSERT, UPDATE, DELETE policies using is_manager
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;

CREATE POLICY "Admins and managers can insert user roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "Admins and managers can update user roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.is_manager(auth.uid()));

CREATE POLICY "Admins and managers can delete user roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.is_manager(auth.uid()));

-- profiles: DROP and recreate UPDATE policy
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

CREATE POLICY "Admins and managers can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_manager(auth.uid()));

-- user_invitations: DROP and recreate INSERT, DELETE policies
DROP POLICY IF EXISTS "Admins can create invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Admins can delete invitations" ON public.user_invitations;

CREATE POLICY "Admins and managers can create invitations"
ON public.user_invitations FOR INSERT
TO authenticated
WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "Admins and managers can delete invitations"
ON public.user_invitations FOR DELETE
TO authenticated
USING (public.is_manager(auth.uid()));
