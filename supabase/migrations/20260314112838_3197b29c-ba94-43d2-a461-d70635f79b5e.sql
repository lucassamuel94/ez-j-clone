-- Allow anon users to read pipeline statuses (config data, not sensitive)
CREATE POLICY "Anon can view pipeline statuses" 
ON public.pipeline_statuses 
FOR SELECT 
TO anon 
USING (true);