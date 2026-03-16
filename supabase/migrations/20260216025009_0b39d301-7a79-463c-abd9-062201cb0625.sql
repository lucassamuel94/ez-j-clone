
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'nenhuma';
