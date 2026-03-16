-- Fix FK constraints blocking opportunity deletion
-- proposals: SET NULL on delete (preserve proposal history but unlink)
ALTER TABLE public.proposals DROP CONSTRAINT proposals_opportunity_id_fkey;
ALTER TABLE public.proposals ADD CONSTRAINT proposals_opportunity_id_fkey 
  FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE SET NULL;

-- projects: SET NULL on delete (preserve project but unlink)
ALTER TABLE public.projects DROP CONSTRAINT projects_opportunity_id_fkey;
ALTER TABLE public.projects ADD CONSTRAINT projects_opportunity_id_fkey 
  FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE SET NULL;