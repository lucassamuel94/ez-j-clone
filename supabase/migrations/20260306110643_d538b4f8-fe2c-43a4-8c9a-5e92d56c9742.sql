ALTER TABLE public.automatic_messages 
ADD COLUMN IF NOT EXISTS trigger_module text,
ADD COLUMN IF NOT EXISTS trigger_event text,
ADD COLUMN IF NOT EXISTS trigger_phase text,
ADD COLUMN IF NOT EXISTS trigger_stage text;