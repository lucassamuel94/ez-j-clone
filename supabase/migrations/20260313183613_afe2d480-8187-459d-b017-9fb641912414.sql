
-- Drop old CHECK constraint and add new one with 'evolution'
ALTER TABLE public.pipeline_statuses DROP CONSTRAINT pipeline_statuses_pipeline_check;
ALTER TABLE public.pipeline_statuses ADD CONSTRAINT pipeline_statuses_pipeline_check CHECK (pipeline = ANY (ARRAY['sdr'::text, 'closer'::text, 'api_oficial'::text, 'evolution'::text]));

-- Seed evolution stages (only if not already present)
INSERT INTO public.pipeline_statuses (pipeline, status_name, sort_order, is_system, color)
SELECT 'evolution', s.status_name, s.sort_order, s.is_system, s.color
FROM (VALUES
  ('Proposta enviada', 1, false, '#3b82f6'),
  ('Negociação', 2, false, '#f59e0b'),
  ('Contrato enviado', 3, false, '#8b5cf6'),
  ('Aguardando pagamento', 4, false, '#06b6d4'),
  ('Ganho', 90, true, '#22c55e'),
  ('Perdido', 91, true, '#ef4444')
) AS s(status_name, sort_order, is_system, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.pipeline_statuses WHERE pipeline = 'evolution'
);
