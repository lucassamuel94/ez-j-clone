
CREATE POLICY "Anyone can view proposals by id"
ON public.proposals
FOR SELECT
USING (true);
