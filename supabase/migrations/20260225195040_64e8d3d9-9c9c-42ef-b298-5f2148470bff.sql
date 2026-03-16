ALTER TABLE public.automatic_messages
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_prompt text;