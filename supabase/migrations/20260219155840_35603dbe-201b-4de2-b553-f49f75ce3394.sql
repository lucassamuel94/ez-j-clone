
-- Create teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create team_members table
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Teams policies
CREATE POLICY "Authenticated users can view teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Managers can insert teams" ON public.teams FOR INSERT WITH CHECK (is_manager(auth.uid()));
CREATE POLICY "Managers can update teams" ON public.teams FOR UPDATE USING (is_manager(auth.uid()));
CREATE POLICY "Managers can delete teams" ON public.teams FOR DELETE USING (is_manager(auth.uid()));

-- Team members policies
CREATE POLICY "Authenticated users can view team members" ON public.team_members FOR SELECT USING (true);
CREATE POLICY "Managers can insert team members" ON public.team_members FOR INSERT WITH CHECK (is_manager(auth.uid()));
CREATE POLICY "Managers can delete team members" ON public.team_members FOR DELETE USING (is_manager(auth.uid()));
