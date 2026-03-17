-- Normalize duplicate lead_status enum values
-- The DB has both "Agendar retorno" and "Agendar Retorno", and both
-- "Reunião agendada" and "Reunião Agendada". The frontend consistently
-- uses the lowercase variants. This migration normalizes any existing
-- data to prevent leads from being invisible in filters/kanban.
UPDATE public.leads SET status = 'Agendar retorno' WHERE status = 'Agendar Retorno';
UPDATE public.leads SET status = 'Reunião agendada' WHERE status = 'Reunião Agendada';
