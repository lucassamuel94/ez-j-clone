ALTER TABLE public.project_phases ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS delivered_at timestamptz;