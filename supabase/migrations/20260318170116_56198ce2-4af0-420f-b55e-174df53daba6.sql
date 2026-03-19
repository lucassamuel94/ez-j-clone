-- Add missing razao_social column to proposals
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS razao_social TEXT;

-- Backfill from linked leads via opportunities
UPDATE public.proposals p
SET razao_social = l.razao_social
FROM public.opportunities o
JOIN public.leads l ON l.id = o.lead_id
WHERE p.opportunity_id = o.id
  AND p.razao_social IS NULL
  AND l.razao_social IS NOT NULL;