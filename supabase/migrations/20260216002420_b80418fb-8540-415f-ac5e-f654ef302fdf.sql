
ALTER TABLE public.forms 
  ADD COLUMN post_action text NOT NULL DEFAULT 'sdr',
  ADD COLUMN assigned_closer_id uuid;
