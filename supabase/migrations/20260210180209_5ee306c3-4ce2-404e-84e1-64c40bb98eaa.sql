
-- Allow authenticated users to see closer roles (needed for meeting scheduling)
CREATE POLICY "Authenticated users can view closer roles"
ON public.user_roles
FOR SELECT
USING (role = 'closer');
