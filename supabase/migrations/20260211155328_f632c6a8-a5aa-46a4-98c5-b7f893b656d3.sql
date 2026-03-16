
-- Add EZ Call specific columns to products table
ALTER TABLE public.products
  ADD COLUMN min_extensions INTEGER DEFAULT 0,
  ADD COLUMN max_extensions INTEGER DEFAULT 0,
  ADD COLUMN price_per_extension NUMERIC DEFAULT 0,
  ADD COLUMN custom_pricing BOOLEAN DEFAULT false,
  ADD COLUMN features JSONB DEFAULT '[]'::jsonb;
