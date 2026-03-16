-- Add new status 'Agendar Retorno' to the lead_status enum
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'Agendar Retorno' AFTER 'Interesse';