
-- 1. Create project_status_history table
CREATE TABLE public.project_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,
  reason text
);

CREATE INDEX idx_project_status_history_project_changed
  ON public.project_status_history (project_id, changed_at);

-- 2. Enable RLS
ALTER TABLE public.project_status_history ENABLE ROW LEVEL SECURITY;

-- Managers / admins can read all
CREATE POLICY "Managers and admins can read status history"
  ON public.project_status_history FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'manager')
  );

-- Project members can read their project's history
CREATE POLICY "Project members can read status history"
  ON public.project_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND (
          p.head_user_id = auth.uid() OR
          p.dev_user_id = auth.uid() OR
          p.ux_po_user_id = auth.uid() OR
          p.treinamento_user_id = auth.uid() OR
          p.ativacao_user_id = auth.uid() OR
          p.closer_user_id = auth.uid() OR
          p.sdr_user_id = auth.uid() OR
          p.created_by_user_id = auth.uid()
        )
    )
  );

-- Insert policy for trigger (runs as SECURITY DEFINER so not strictly needed, but good practice)
CREATE POLICY "System can insert status history"
  ON public.project_status_history FOR INSERT TO authenticated
  WITH CHECK (true);

-- 3. Trigger function
CREATE OR REPLACE FUNCTION public.fn_track_project_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.overall_status IS DISTINCT FROM NEW.overall_status THEN
    INSERT INTO public.project_status_history (project_id, status, changed_at, changed_by)
    VALUES (NEW.id, NEW.overall_status, now(), auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_track_project_status_change
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_track_project_status_change();

-- 4. Retroactive seed: one record per project with current status
INSERT INTO public.project_status_history (project_id, status, changed_at)
SELECT id, overall_status, created_at
FROM public.projects
WHERE deleted_at IS NULL;
