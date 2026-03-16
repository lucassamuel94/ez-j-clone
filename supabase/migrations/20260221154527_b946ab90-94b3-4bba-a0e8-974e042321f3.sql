
-- Add missing columns to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS storage_time text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS closer_name text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS sdr_name text;
