
-- Create goals table
CREATE TABLE public.goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  target_user_id UUID REFERENCES public.profiles(id),
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL CHECK (period_year >= 2024),
  meetings_scheduled_goal INTEGER NOT NULL DEFAULT 0,
  meetings_held_percentage NUMERIC(5,2) NOT NULL DEFAULT 60,
  sqo_percentage NUMERIC(5,2) NOT NULL DEFAULT 35,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (target_user_id, period_month, period_year)
);

-- Enable RLS
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- Managers and admins can view all goals
CREATE POLICY "Managers can view all goals"
  ON public.goals FOR SELECT
  USING (is_manager(auth.uid()));

-- SDRs can view their own goals
CREATE POLICY "Users can view own goals"
  ON public.goals FOR SELECT
  USING (target_user_id = auth.uid());

-- Managers and admins can insert goals
CREATE POLICY "Managers can insert goals"
  ON public.goals FOR INSERT
  WITH CHECK (is_manager(auth.uid()));

-- Managers and admins can update goals
CREATE POLICY "Managers can update goals"
  ON public.goals FOR UPDATE
  USING (is_manager(auth.uid()));

-- Managers and admins can delete goals
CREATE POLICY "Managers can delete goals"
  ON public.goals FOR DELETE
  USING (is_manager(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
