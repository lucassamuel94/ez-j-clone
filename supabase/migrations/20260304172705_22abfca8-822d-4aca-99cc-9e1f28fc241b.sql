
CREATE TABLE public.pipeline_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline text NOT NULL CHECK (pipeline IN ('sdr', 'closer')),
  status_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view pipeline statuses" ON public.pipeline_statuses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can insert pipeline statuses" ON public.pipeline_statuses
  FOR INSERT TO authenticated WITH CHECK (is_manager(auth.uid()));

CREATE POLICY "Managers can update pipeline statuses" ON public.pipeline_statuses
  FOR UPDATE TO authenticated USING (is_manager(auth.uid()));

CREATE POLICY "Managers can delete pipeline statuses" ON public.pipeline_statuses
  FOR DELETE TO authenticated USING (is_manager(auth.uid()));

-- Seed SDR statuses
INSERT INTO public.pipeline_statuses (pipeline, status_name, sort_order, is_system) VALUES
  ('sdr', 'Novo', 0, true),
  ('sdr', 'Em contato', 1, false),
  ('sdr', 'Não atendeu', 2, false),
  ('sdr', 'Ocupado', 3, false),
  ('sdr', 'Agendar retorno', 4, false),
  ('sdr', 'Sem retorno', 5, false),
  ('sdr', 'Reagendar Reunião', 6, false),
  ('sdr', 'Interesse', 7, false),
  ('sdr', 'Interesse/Agendar Retorno', 8, false),
  ('sdr', 'Reunião agendada', 9, false),
  ('sdr', 'Reciclagem', 10, false),
  ('sdr', 'Devolvido pelo Closer', 11, false),
  ('sdr', 'Oportunidade criada', 90, true),
  ('sdr', 'Descartado', 91, true);

-- Seed Closer statuses
INSERT INTO public.pipeline_statuses (pipeline, status_name, sort_order, is_system) VALUES
  ('closer', 'Demonstração', 0, true),
  ('closer', 'Proposta enviada', 1, false),
  ('closer', 'Oportunidade quente', 2, false),
  ('closer', 'Oportunidade Futura', 3, false),
  ('closer', 'Oportunidade fria', 4, false),
  ('closer', 'Contrato enviado', 5, false),
  ('closer', 'Aguardando pagamento', 6, false),
  ('closer', 'Ganho', 90, true),
  ('closer', 'Perdido', 91, true);
