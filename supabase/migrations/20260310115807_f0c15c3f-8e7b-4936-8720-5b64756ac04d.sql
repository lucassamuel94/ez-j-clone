ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS show_meta_costs boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS meta_cost_config jsonb;