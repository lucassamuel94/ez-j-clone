
CREATE TABLE public.team_phase_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  phase_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, phase_name)
);

ALTER TABLE public.team_phase_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read team_phase_map"
  ON public.team_phase_map FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage team_phase_map"
  ON public.team_phase_map FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
