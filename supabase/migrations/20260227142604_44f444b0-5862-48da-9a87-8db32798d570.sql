-- Allow SDRs to read active_clients for ICP analysis
CREATE POLICY "SDRs can view active_clients for ICP"
  ON public.active_clients FOR SELECT
  USING (has_role(auth.uid(), 'sdr'::app_role));

-- Allow SDRs to read icp_analyses
CREATE POLICY "SDRs can view icp_analyses"
  ON public.icp_analyses FOR SELECT
  USING (has_role(auth.uid(), 'sdr'::app_role));