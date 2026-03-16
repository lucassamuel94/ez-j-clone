
-- Drop ALL existing SELECT policies on user_roles
DROP POLICY IF EXISTS "Admins and managers can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read their own role" ON public.user_roles;

-- Policy 1: Users can ALWAYS read their own role (no function calls, no recursion possible)
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: Admins can view all roles (uses SECURITY DEFINER function)
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Ensure has_role is properly secured
REVOKE EXECUTE ON FUNCTION public.has_role FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;
