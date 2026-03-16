-- Create lead_activity_logs table
CREATE TABLE public.lead_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  action_type TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_lead_activity_logs_lead_id ON public.lead_activity_logs(lead_id);
CREATE INDEX idx_lead_activity_logs_created_at ON public.lead_activity_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.lead_activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view activity logs on accessible leads"
ON public.lead_activity_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_activity_logs.lead_id
    AND (leads.owner_user_id = auth.uid() OR is_manager(auth.uid()))
  )
);

CREATE POLICY "Users can create activity logs"
ON public.lead_activity_logs
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Add comment for documentation
COMMENT ON TABLE public.lead_activity_logs IS 'Stores activity history for leads - tracks all changes and actions';