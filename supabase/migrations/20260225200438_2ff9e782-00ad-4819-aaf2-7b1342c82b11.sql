
-- Create table for dynamic phase statuses
CREATE TABLE public.project_phase_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_name text NOT NULL,
  status_name text NOT NULL,
  sort_order integer NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(phase_name, status_name)
);

-- Enable RLS
ALTER TABLE public.project_phase_statuses ENABLE ROW LEVEL SECURITY;

-- SELECT for all authenticated
CREATE POLICY "Authenticated users can view phase statuses"
  ON public.project_phase_statuses FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE for managers only
CREATE POLICY "Managers can insert phase statuses"
  ON public.project_phase_statuses FOR INSERT
  TO authenticated
  WITH CHECK (is_manager(auth.uid()));

CREATE POLICY "Managers can update phase statuses"
  ON public.project_phase_statuses FOR UPDATE
  TO authenticated
  USING (is_manager(auth.uid()));

CREATE POLICY "Managers can delete phase statuses"
  ON public.project_phase_statuses FOR DELETE
  TO authenticated
  USING (is_manager(auth.uid()));

-- Seed with current hardcoded statuses
INSERT INTO public.project_phase_statuses (phase_name, status_name, sort_order, is_system) VALUES
  -- validacao
  ('validacao', 'BACKLOG', 0, true),
  ('validacao', 'EM ANÁLISE', 1, false),
  ('validacao', 'DADOS INCOMPLETOS', 2, false),
  ('validacao', 'VALIDADO', 3, false),
  ('validacao', 'CONCLUÍDO', 4, true),
  -- ux_po
  ('ux_po', 'BACKLOG', 0, true),
  ('ux_po', 'MAPEAMENTO DE PROCESSOS', 1, false),
  ('ux_po', 'MONTAGEM DE FLUXO', 2, false),
  ('ux_po', 'REVISÃO INTERNA', 3, false),
  ('ux_po', 'APROVAÇÃO DO CLIENTE', 4, false),
  ('ux_po', 'AJUSTES', 5, false),
  ('ux_po', 'CONCLUÍDO', 6, true),
  -- dev_chatbot
  ('dev_chatbot', 'BACKLOG', 0, true),
  ('dev_chatbot', 'DESENVOLVIMENTO', 1, false),
  ('dev_chatbot', 'QA', 2, false),
  ('dev_chatbot', 'REVISÃO', 3, false),
  ('dev_chatbot', 'CONCLUÍDO', 4, true),
  -- treinamento
  ('treinamento', 'BACKLOG', 0, true),
  ('treinamento', 'AGENDAMENTO', 1, false),
  ('treinamento', 'MATERIAL PREPARADO', 2, false),
  ('treinamento', 'TREINAMENTO REALIZADO', 3, false),
  ('treinamento', 'CONCLUÍDO', 4, true),
  -- ativacao
  ('ativacao', 'BACKLOG', 0, true),
  ('ativacao', 'EM ANDAMENTO', 1, false),
  ('ativacao', 'COM PENDÊNCIA', 2, false),
  ('ativacao', 'CONCLUÍDO', 3, true),
  -- verificacao_bm
  ('verificacao_bm', 'BACKLOG', 0, true),
  ('verificacao_bm', 'EM CONTATO', 1, false),
  ('verificacao_bm', 'REUNIÃO AGENDADA', 2, false),
  ('verificacao_bm', 'AGUARDANDO CLIENTE', 3, false),
  ('verificacao_bm', 'AGUARDANDO META', 4, false),
  ('verificacao_bm', 'PAUSADO', 5, false),
  ('verificacao_bm', 'CANCELADO', 6, false),
  ('verificacao_bm', 'CONCLUÍDO', 7, true),
  -- automacao
  ('automacao', 'BACKLOG', 0, true),
  ('automacao', 'EM DESENVOLVIMENTO', 1, false),
  ('automacao', 'EM TESTE', 2, false),
  ('automacao', 'CONCLUÍDO', 3, true),
  -- curadoria_ia
  ('curadoria_ia', 'BACKLOG', 0, true),
  ('curadoria_ia', 'EM PROCESSO DE CURADORIA', 1, false),
  ('curadoria_ia', 'EM PAUSA', 2, false),
  ('curadoria_ia', 'GESTÃO DE PENDÊNCIAS', 3, false),
  ('curadoria_ia', 'CONCLUÍDO', 4, true),
  -- go_live_assistido
  ('go_live_assistido', 'BACKLOG', 0, true),
  ('go_live_assistido', 'EM ACOMPANHAMENTO', 1, false),
  ('go_live_assistido', 'CONCLUÍDO', 2, true);
