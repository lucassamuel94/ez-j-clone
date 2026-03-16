
-- Junction table to associate email templates with teams
CREATE TABLE public.email_template_teams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.email_templates(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (template_id, team_id)
);

-- Enable RLS
ALTER TABLE public.email_template_teams ENABLE ROW LEVEL SECURITY;

-- Managers can manage template-team associations
CREATE POLICY "Managers can insert email_template_teams"
ON public.email_template_teams FOR INSERT
WITH CHECK (is_manager(auth.uid()));

CREATE POLICY "Managers can delete email_template_teams"
ON public.email_template_teams FOR DELETE
USING (is_manager(auth.uid()));

CREATE POLICY "Authenticated users can view email_template_teams"
ON public.email_template_teams FOR SELECT
USING (true);
