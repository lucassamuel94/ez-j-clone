
-- Rename 'Agendar Retorno' to 'Interesse/Agendar Retorno'
ALTER TYPE public.lead_status RENAME VALUE 'Agendar Retorno' TO 'Interesse/Agendar Retorno';

-- Migrate any leads with 'Interesse' status to the new combined status
UPDATE public.leads SET status = 'Interesse/Agendar Retorno' WHERE status = 'Interesse';
