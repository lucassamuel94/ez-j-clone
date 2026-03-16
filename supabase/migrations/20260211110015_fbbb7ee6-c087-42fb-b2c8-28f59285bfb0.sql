
-- Table to log AI usage per call
CREATE TABLE public.ai_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_id text NOT NULL REFERENCES public.ai_prompts(id),
  model text NOT NULL,
  tokens_input integer NOT NULL DEFAULT 0,
  tokens_output integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  user_id uuid REFERENCES public.profiles(id),
  lead_id uuid REFERENCES public.leads(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Only admins/managers can view usage logs
CREATE POLICY "Managers can view ai usage logs"
  ON public.ai_usage_logs FOR SELECT
  USING (is_manager(auth.uid()));

-- Service role inserts (from edge functions)
CREATE POLICY "Service role can insert ai usage logs"
  ON public.ai_usage_logs FOR INSERT
  WITH CHECK (true);

-- Index for quick aggregation by prompt
CREATE INDEX idx_ai_usage_logs_prompt_id ON public.ai_usage_logs(prompt_id);
CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at);
