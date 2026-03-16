-- Create call_history table for webphone call tracking
CREATE TABLE public.call_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  duration_seconds INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'ringing', 'answered', 'completed', 'missed', 'busy', 'no_answer', 'failed')),
  lead_name TEXT,
  lead_company TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_history ENABLE ROW LEVEL SECURITY;

-- Policies: Users can see their own call history
CREATE POLICY "Users can view their own call history"
  ON public.call_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own call history"
  ON public.call_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own call history"
  ON public.call_history
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins/Managers can see all call history
CREATE POLICY "Admins can view all call history"
  ON public.call_history
  FOR SELECT
  USING (public.is_manager(auth.uid()));

-- Index for faster queries
CREATE INDEX idx_call_history_user_id ON public.call_history(user_id);
CREATE INDEX idx_call_history_lead_id ON public.call_history(lead_id);
CREATE INDEX idx_call_history_started_at ON public.call_history(started_at DESC);