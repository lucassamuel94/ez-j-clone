
-- Add new columns for phase-based triggers
ALTER TABLE public.project_automations
  ADD COLUMN IF NOT EXISTS trigger_from_phase text,
  ADD COLUMN IF NOT EXISTS trigger_to_phase text;

-- No enum constraints to update since trigger_type and action_type are just text columns.
-- The application code handles validation of allowed values.
