-- Add new lead statuses to the enum
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'Não atendeu';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'Ocupado';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'Agendar retorno';