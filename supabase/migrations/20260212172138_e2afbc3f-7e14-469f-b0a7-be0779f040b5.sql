
-- Add view_count column to proposals
ALTER TABLE public.proposals ADD COLUMN view_count integer NOT NULL DEFAULT 0;

-- Create a function to increment view count (accessible without auth)
CREATE OR REPLACE FUNCTION public.increment_proposal_views(proposal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.proposals SET view_count = view_count + 1 WHERE id = proposal_id;
END;
$$;
