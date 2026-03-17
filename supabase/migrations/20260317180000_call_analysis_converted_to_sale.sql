-- Flag para marcar qual análise resultou em venda real
ALTER TABLE public.call_analyses
  ADD COLUMN IF NOT EXISTS converted_to_sale boolean NOT NULL DEFAULT false;
