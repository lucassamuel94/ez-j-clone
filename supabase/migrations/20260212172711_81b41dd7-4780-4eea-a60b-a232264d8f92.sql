
-- Create table to track individual proposal views
CREATE TABLE public.proposal_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

-- Enable RLS
ALTER TABLE public.proposal_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert views (public proposal page, no auth required)
CREATE POLICY "Anyone can insert proposal views"
ON public.proposal_views FOR INSERT
WITH CHECK (true);

-- Authenticated users can view proposal views they have access to
CREATE POLICY "Users can view proposal views"
ON public.proposal_views FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.proposals p
    WHERE p.id = proposal_views.proposal_id
    AND (p.created_by_user_id = auth.uid() OR is_manager(auth.uid()))
  )
);

-- Update the increment function to also insert a view record
CREATE OR REPLACE FUNCTION public.increment_proposal_views(proposal_id uuid, p_user_agent text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.proposals SET view_count = view_count + 1 WHERE id = proposal_id;
  INSERT INTO public.proposal_views (proposal_id, user_agent) VALUES (proposal_id, p_user_agent);
END;
$$;
