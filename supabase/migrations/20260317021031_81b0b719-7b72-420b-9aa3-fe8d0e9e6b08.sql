
-- 1. Create api_activation_history table
CREATE TABLE public.api_activation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.api_oficial_deals(id) ON DELETE CASCADE,
  stage text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  blocked_reason text
);

-- 2. Enable RLS
ALTER TABLE public.api_activation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view activation history"
  ON public.api_activation_history FOR SELECT
  TO authenticated USING (true);

-- 3. Index for fast lookups
CREATE INDEX idx_api_activation_history_deal ON public.api_activation_history(deal_id);
CREATE INDEX idx_api_activation_history_changed ON public.api_activation_history(changed_at);

-- 4. Trigger function
CREATE OR REPLACE FUNCTION public.track_api_activation_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO public.api_activation_history (deal_id, stage, changed_at, blocked_reason)
    VALUES (NEW.id, NEW.stage, now(), NEW.lost_reason);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_api_activation_stage_change
  AFTER UPDATE ON public.api_oficial_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.track_api_activation_stage_change();

-- 5. Seed retroactive history from existing deals
INSERT INTO public.api_activation_history (deal_id, stage, changed_at, blocked_reason)
SELECT id, stage, COALESCE(created_at, now()), lost_reason
FROM public.api_oficial_deals;
