
-- Add account_owner_id column to active_clients
ALTER TABLE public.active_clients
  ADD COLUMN account_owner_id uuid REFERENCES public.profiles(id);

CREATE INDEX idx_active_clients_owner ON public.active_clients(account_owner_id);

-- Closers can view their own clients
CREATE POLICY "Closers can view own portfolio clients"
  ON public.active_clients
  FOR SELECT
  USING (account_owner_id = auth.uid());

-- Managers can view all clients
CREATE POLICY "Managers can view all clients"
  ON public.active_clients
  FOR SELECT
  USING (is_manager(auth.uid()));

-- Closers can update their own clients (notes, etc)
CREATE POLICY "Closers can update own portfolio clients"
  ON public.active_clients
  FOR UPDATE
  USING (account_owner_id = auth.uid());

-- Managers can update any client (including assigning owners)
CREATE POLICY "Managers can update any client"
  ON public.active_clients
  FOR UPDATE
  USING (is_manager(auth.uid()));
