
-- Allow all authenticated users to view all roles (needed for project assignment dropdowns)
CREATE POLICY "Authenticated users can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- Drop the now-redundant partial SELECT policies
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can view closer roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can view manager roles" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can view sdr roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
