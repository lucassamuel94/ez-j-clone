-- Allow admins to delete any lead
CREATE POLICY "Admins can delete any lead"
ON public.leads
FOR DELETE
USING (is_admin(auth.uid()));

-- Add function to bulk delete leads
CREATE OR REPLACE FUNCTION public.bulk_delete_leads(lead_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Check if user is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can bulk delete leads';
  END IF;
  
  -- Delete related records first (cascade should handle this, but being explicit)
  DELETE FROM public.lead_notes WHERE lead_id = ANY(lead_ids);
  DELETE FROM public.interactions WHERE lead_id = ANY(lead_ids);
  DELETE FROM public.lead_cadences WHERE lead_id = ANY(lead_ids);
  DELETE FROM public.meetings WHERE lead_id = ANY(lead_ids);
  DELETE FROM public.opportunities WHERE lead_id = ANY(lead_ids);
  
  -- Delete leads
  DELETE FROM public.leads WHERE id = ANY(lead_ids);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;