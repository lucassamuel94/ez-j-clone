-- Allow Closers to read icp_analyses for ICP Analysis page
CREATE POLICY "Closers can view icp_analyses"
ON public.icp_analyses
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'closer'));

-- Allow Closers to read all leads for ICP/CNAE analysis
CREATE POLICY "Closers can view all leads for ICP analysis"
ON public.leads
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'closer'));