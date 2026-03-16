
-- Add notification preferences to forms
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS notify_push boolean NOT NULL DEFAULT false;
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS notify_email boolean NOT NULL DEFAULT false;
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS notify_user_ids uuid[] DEFAULT NULL;
