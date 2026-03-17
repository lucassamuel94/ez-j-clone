-- Add razao_social snapshot column to proposals table.
-- This stores the legal company name at proposal creation time, decoupling it
-- from the live lead record so that future changes to the lead do not affect
-- previously generated proposals.

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS razao_social TEXT;

-- Backfill existing proposals from the linked lead's razao_social
UPDATE public.proposals p
SET razao_social = l.razao_social
FROM public.opportunities o
JOIN public.leads l ON l.id = o.lead_id
WHERE p.opportunity_id = o.id
  AND p.razao_social IS NULL
  AND l.razao_social IS NOT NULL;
