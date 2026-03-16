
-- Add deal value to opportunities for tracking revenue
ALTER TABLE public.opportunities
  ADD COLUMN deal_value NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.opportunities.deal_value IS 'Setup value in R$ for this opportunity';
