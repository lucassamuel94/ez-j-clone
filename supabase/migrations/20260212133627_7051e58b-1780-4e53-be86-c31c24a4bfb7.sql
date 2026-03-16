-- Add 'Devolvido pelo Closer' to lead_status enum
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'Devolvido pelo Closer';