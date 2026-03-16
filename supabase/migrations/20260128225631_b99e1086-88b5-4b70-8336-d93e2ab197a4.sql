-- Create enums for lead types and statuses
CREATE TYPE public.lead_type AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE public.lead_status AS ENUM ('Novo', 'Em contato', 'Interesse', 'Oportunidade criada', 'Descartado');
CREATE TYPE public.channel_type AS ENUM ('whatsapp', 'call', 'email', 'other');
CREATE TYPE public.interaction_outcome AS ENUM ('sem_resposta', 'respondeu', 'qualificado', 'reagendado', 'descartado');
CREATE TYPE public.user_role AS ENUM ('sdr', 'manager', 'admin');

-- Create users/profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'sdr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create cadences table (for outbound sequences)
CREATE TABLE public.cadences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create cadence_steps table
CREATE TABLE public.cadence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cadence_id UUID NOT NULL REFERENCES public.cadences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  wait_hours INTEGER NOT NULL DEFAULT 0,
  channel channel_type NOT NULL,
  script_template TEXT NOT NULL,
  objective TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cadence_id, step_number)
);

-- Create leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_type lead_type NOT NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  whatsapp TEXT,
  phone TEXT,
  email TEXT,
  source TEXT,
  status lead_status NOT NULL DEFAULT 'Novo',
  owner_user_id UUID REFERENCES public.profiles(id),
  priority_score INTEGER NOT NULL DEFAULT 0,
  last_contact_at TIMESTAMPTZ,
  next_action_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts_count INTEGER NOT NULL DEFAULT 0,
  -- INBOUND specific fields
  initial_message TEXT,
  entry_channel channel_type,
  -- OUTBOUND specific fields
  icp_fit TEXT,
  list_reason TEXT,
  cadence_id UUID REFERENCES public.cadences(id),
  current_cadence_step INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create lead_notes table
CREATE TABLE public.lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create interactions table
CREATE TABLE public.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  channel channel_type NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  outcome interaction_outcome NOT NULL,
  message_summary TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create lead_cadence table (tracks lead progress in outbound cadences)
CREATE TABLE public.lead_cadences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  cadence_id UUID NOT NULL REFERENCES public.cadences(id),
  current_step_number INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_step_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  result TEXT,
  UNIQUE(lead_id)
);

-- Create opportunities table
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES public.profiles(id),
  assigned_to_user_id UUID REFERENCES public.profiles(id),
  stage TEXT NOT NULL DEFAULT 'Qualificação',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_cadences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- RLS Policies for cadences (all authenticated users can view)
CREATE POLICY "Authenticated users can view cadences" ON public.cadences
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage cadences" ON public.cadences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for cadence_steps
CREATE POLICY "Authenticated users can view cadence steps" ON public.cadence_steps
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage cadence steps" ON public.cadence_steps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for leads (SDRs see their own, managers see all)
CREATE POLICY "Users can view own leads" ON public.leads
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR owner_user_id IS NULL);

CREATE POLICY "Users can insert leads" ON public.leads
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update own leads" ON public.leads
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid() OR owner_user_id IS NULL);

CREATE POLICY "Users can delete own leads" ON public.leads
  FOR DELETE TO authenticated USING (owner_user_id = auth.uid());

-- RLS Policies for lead_notes
CREATE POLICY "Users can view notes on accessible leads" ON public.lead_notes
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.leads WHERE id = lead_id AND (owner_user_id = auth.uid() OR owner_user_id IS NULL))
  );

CREATE POLICY "Users can create notes" ON public.lead_notes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- RLS Policies for interactions
CREATE POLICY "Users can view interactions on accessible leads" ON public.interactions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.leads WHERE id = lead_id AND (owner_user_id = auth.uid() OR owner_user_id IS NULL))
  );

CREATE POLICY "Users can create interactions" ON public.interactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- RLS Policies for lead_cadences
CREATE POLICY "Users can view lead cadences" ON public.lead_cadences
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.leads WHERE id = lead_id AND (owner_user_id = auth.uid() OR owner_user_id IS NULL))
  );

CREATE POLICY "Users can manage lead cadences" ON public.lead_cadences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for opportunities
CREATE POLICY "Users can view opportunities" ON public.opportunities
  FOR SELECT TO authenticated USING (
    created_by_user_id = auth.uid() OR assigned_to_user_id = auth.uid()
  );

CREATE POLICY "Users can create opportunities" ON public.opportunities
  FOR INSERT TO authenticated WITH CHECK (created_by_user_id = auth.uid());

CREATE POLICY "Users can update own opportunities" ON public.opportunities
  FOR UPDATE TO authenticated USING (created_by_user_id = auth.uid() OR assigned_to_user_id = auth.uid());

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cadences_updated_at BEFORE UPDATE ON public.cadences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 'sdr');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for performance
CREATE INDEX idx_leads_owner ON public.leads(owner_user_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_type ON public.leads(lead_type);
CREATE INDEX idx_leads_next_action ON public.leads(next_action_at);
CREATE INDEX idx_interactions_lead ON public.interactions(lead_id);
CREATE INDEX idx_lead_notes_lead ON public.lead_notes(lead_id);