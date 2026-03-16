-- Allow SDRs to delete opportunities they created (undo send to closer)
CREATE POLICY "SDRs can delete own created opportunities"
ON public.opportunities
FOR DELETE
USING (created_by_user_id = auth.uid());