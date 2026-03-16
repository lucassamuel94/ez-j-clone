
-- Add module column to project_automations
ALTER TABLE public.project_automations 
  ADD COLUMN module text NOT NULL DEFAULT 'projects' 
  CHECK (module IN ('sdr', 'closer', 'proposals', 'projects'));

CREATE INDEX idx_project_automations_module ON public.project_automations (module);
