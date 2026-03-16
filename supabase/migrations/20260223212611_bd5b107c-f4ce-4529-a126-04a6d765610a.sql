-- Allow tasks to exist without a project (for closer opportunities without projects)
ALTER TABLE public.project_tasks ALTER COLUMN project_id DROP NOT NULL;