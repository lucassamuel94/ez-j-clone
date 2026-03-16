-- Add company info fields to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS company_segment TEXT,
ADD COLUMN IF NOT EXISTS product_interest TEXT,
ADD COLUMN IF NOT EXISTS uses_platform BOOLEAN,
ADD COLUMN IF NOT EXISTS daily_service_volume TEXT,
ADD COLUMN IF NOT EXISTS main_pain_point TEXT,
ADD COLUMN IF NOT EXISTS solution_urgency TEXT,
ADD COLUMN IF NOT EXISTS has_budget TEXT;