-- Add temperature column to leads table
ALTER TABLE public.leads 
ADD COLUMN temperature text CHECK (temperature IN ('frio', 'morno', 'quente'));