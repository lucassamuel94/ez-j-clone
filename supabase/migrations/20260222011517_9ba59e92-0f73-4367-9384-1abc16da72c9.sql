-- Allow admins to update deliveries
CREATE POLICY "Admins can update deliveries"
ON public.project_deliveries FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));