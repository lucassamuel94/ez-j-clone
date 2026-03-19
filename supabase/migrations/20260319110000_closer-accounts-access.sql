-- Allow closers to view all accounts so they can create deals from the client base.
-- Without this, createDealFromActiveClient fails with RLS denial when the closer
-- has no prior opportunity linked to the account.
CREATE POLICY "Closers can view accounts for deals"
  ON public.accounts FOR SELECT
  USING (has_role(auth.uid(), 'closer'::app_role));
