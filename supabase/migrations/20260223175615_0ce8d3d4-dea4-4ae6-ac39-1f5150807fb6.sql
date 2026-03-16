-- Allow all authenticated users to see SDR roles (needed for redistribution)
CREATE POLICY "Authenticated users can view sdr roles"
ON public.user_roles
FOR SELECT
USING (role = 'sdr'::app_role);

-- Allow all authenticated users to see manager roles
CREATE POLICY "Authenticated users can view manager roles"
ON public.user_roles
FOR SELECT
USING (role = 'manager'::app_role);
