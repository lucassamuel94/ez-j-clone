-- Add missing enum values for SDR pipeline alignment
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'Lead Quente';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'Reunião Agendada';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'Agendar Retorno';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'Reunião Confirmada';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'Oportunidade Futura';