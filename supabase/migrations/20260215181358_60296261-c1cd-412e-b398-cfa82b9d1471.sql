
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS card_border_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS card_border_color text NOT NULL DEFAULT '#e5e7eb',
  ADD COLUMN IF NOT EXISTS card_border_width integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS card_border_radius integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS card_bg_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS card_bg_color text NOT NULL DEFAULT '#ffffff';
