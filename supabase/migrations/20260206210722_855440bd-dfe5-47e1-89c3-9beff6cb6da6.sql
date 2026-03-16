-- Add address fields to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS logradouro text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS bairro text;