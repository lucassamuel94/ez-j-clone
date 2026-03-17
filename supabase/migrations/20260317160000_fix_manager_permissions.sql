-- Allow managers to view all user roles (needed for Pessoas page)
CREATE POLICY "Managers can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_manager(auth.uid()));

-- Allow managers to view, create, and cancel invitations
CREATE POLICY "Managers can view all invitations"
ON public.user_invitations
FOR SELECT
USING (public.is_manager(auth.uid()));

CREATE POLICY "Managers can create invitations"
ON public.user_invitations
FOR INSERT
WITH CHECK (public.is_manager(auth.uid()));

CREATE POLICY "Managers can delete invitations"
ON public.user_invitations
FOR DELETE
USING (public.is_manager(auth.uid()));

-- Allow managers to update any user profile (name, active status)
CREATE POLICY "Managers can update all profiles"
ON public.profiles
FOR UPDATE
USING (public.is_manager(auth.uid()));
