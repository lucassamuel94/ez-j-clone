
-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Admins and managers can view all roles" ON public.user_roles;

-- The "Users can read their own role" policy already exists and is sufficient
-- Add a policy for admins/managers to view ALL roles using security definer function
CREATE POLICY "Admins and managers can view all roles"
ON public.user_roles
FOR SELECT
USING (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'manager')
);

-- Drop the duplicate self-read policy since the new one covers it
DROP POLICY IF EXISTS "Users can read their own role" ON public.user_roles;
