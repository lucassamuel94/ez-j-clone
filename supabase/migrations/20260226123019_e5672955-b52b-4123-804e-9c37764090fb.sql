CREATE POLICY "Closers can search all clients for deals"
ON public.active_clients
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'closer')
);