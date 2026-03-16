
-- Add parent_id for replies and updated_at for edit tracking
ALTER TABLE public.project_activity_logs 
  ADD COLUMN parent_id uuid NULL REFERENCES public.project_activity_logs(id) ON DELETE CASCADE,
  ADD COLUMN updated_at timestamptz NULL;

-- Index for faster reply lookups
CREATE INDEX idx_project_activity_logs_parent_id ON public.project_activity_logs(parent_id);
