-- Allow managers to delete call analyses
CREATE POLICY "Managers can delete call analyses"
ON public.call_analyses
FOR DELETE
USING (is_manager(auth.uid()));