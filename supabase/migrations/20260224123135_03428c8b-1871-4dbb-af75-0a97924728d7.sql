
-- Add opportunity_id and lead_id columns to project_tasks
ALTER TABLE public.project_tasks
  ADD COLUMN opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  ADD COLUMN lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_project_tasks_opportunity_id ON public.project_tasks(opportunity_id);
CREATE INDEX idx_project_tasks_lead_id ON public.project_tasks(lead_id);
