
-- Add attachments column to email_templates (JSON array of { path, name, type })
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
