
CREATE POLICY "Owners can delete own clients"
  ON public.active_clients FOR DELETE TO authenticated
  USING (account_owner_id = auth.uid());

CREATE POLICY "Managers can delete clients"
  ON public.active_clients FOR DELETE TO authenticated
  USING (is_manager(auth.uid()));
