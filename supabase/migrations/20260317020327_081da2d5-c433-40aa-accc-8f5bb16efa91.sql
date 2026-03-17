
-- Create team_capacity table
CREATE TABLE public.team_capacity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  month date NOT NULL,
  capacity_hours integer NOT NULL DEFAULT 120,
  headcount integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, month)
);

-- Enable RLS
ALTER TABLE public.team_capacity ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view
CREATE POLICY "Authenticated users can view team_capacity"
  ON public.team_capacity FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert/update/delete (manager check can be added later)
CREATE POLICY "Authenticated users can insert team_capacity"
  ON public.team_capacity FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update team_capacity"
  ON public.team_capacity FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete team_capacity"
  ON public.team_capacity FOR DELETE TO authenticated USING (true);

-- Seed: insert 1 record per team for current month with headcount from team_members
INSERT INTO public.team_capacity (team_id, month, capacity_hours, headcount)
SELECT
  t.id,
  date_trunc('month', CURRENT_DATE)::date,
  120,
  GREATEST(1, (SELECT COUNT(*) FROM public.team_members tm WHERE tm.team_id = t.id))
FROM public.teams t
ON CONFLICT (team_id, month) DO NOTHING;
