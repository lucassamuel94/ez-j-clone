
ALTER TABLE public.forms ADD COLUMN redirect_url text DEFAULT NULL;
ALTER TABLE public.forms ADD COLUMN show_recaptcha boolean NOT NULL DEFAULT false;
