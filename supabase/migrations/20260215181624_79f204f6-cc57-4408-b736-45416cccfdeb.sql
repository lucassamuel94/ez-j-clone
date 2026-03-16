
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS field_border_color text NOT NULL DEFAULT '#d1d5db',
  ADD COLUMN IF NOT EXISTS field_border_width integer NOT NULL DEFAULT 1;
