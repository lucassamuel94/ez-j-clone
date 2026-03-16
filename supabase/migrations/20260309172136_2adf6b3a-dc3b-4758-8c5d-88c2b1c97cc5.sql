
-- Allow users to view their own call analyses (uploaded by them or assigned to them as SDR)
CREATE POLICY "Users can view own call analyses"
ON public.call_analyses FOR SELECT
USING (
  auth.uid() = uploaded_by
  OR auth.uid() = sdr_user_id
);
