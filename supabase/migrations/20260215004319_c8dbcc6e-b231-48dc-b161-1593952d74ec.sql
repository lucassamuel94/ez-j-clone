
-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active templates
CREATE POLICY "Authenticated users can view email templates"
ON public.email_templates FOR SELECT
USING (true);

-- Managers can insert templates
CREATE POLICY "Managers can insert email templates"
ON public.email_templates FOR INSERT
WITH CHECK (is_manager(auth.uid()));

-- Managers can update templates
CREATE POLICY "Managers can update email templates"
ON public.email_templates FOR UPDATE
USING (is_manager(auth.uid()));

-- Managers can delete templates
CREATE POLICY "Managers can delete email templates"
ON public.email_templates FOR DELETE
USING (is_manager(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create sent_emails table
CREATE TABLE public.sent_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;

-- Users can insert their own sent emails
CREATE POLICY "Users can insert own sent emails"
ON public.sent_emails FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own sent emails
CREATE POLICY "Users can view own sent emails"
ON public.sent_emails FOR SELECT
USING (auth.uid() = user_id);

-- Managers can view all sent emails
CREATE POLICY "Managers can view all sent emails"
ON public.sent_emails FOR SELECT
USING (is_manager(auth.uid()));
