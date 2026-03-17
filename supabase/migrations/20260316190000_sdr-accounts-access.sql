-- Allow SDRs to see accounts where they are the sdr_user_id on an opportunity
-- Also restore ICP access for SDRs on accounts (replacing the old active_clients policy)

-- 1) Drop and recreate the accounts SELECT policy to include sdr_user_id
DROP POLICY IF EXISTS "Managers view all accounts" ON public.accounts;

CREATE POLICY "Managers view all accounts"
  ON public.accounts FOR SELECT
  USING (
    public.is_manager(auth.uid()) OR public.is_admin(auth.uid())
    OR account_owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.account_id = accounts.id AND leads.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.opportunities
      WHERE opportunities.account_id = accounts.id
        AND opportunities.assigned_to_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.opportunities
      WHERE opportunities.account_id = accounts.id
        AND opportunities.sdr_user_id = auth.uid()
    )
  );

-- 2) Allow SDRs to view all accounts for ICP analysis
--    (replaces the old "SDRs can view active_clients for ICP" policy)
DROP POLICY IF EXISTS "SDRs can view accounts for ICP" ON public.accounts;

CREATE POLICY "SDRs can view accounts for ICP"
  ON public.accounts FOR SELECT
  USING (has_role(auth.uid(), 'sdr'::app_role));
