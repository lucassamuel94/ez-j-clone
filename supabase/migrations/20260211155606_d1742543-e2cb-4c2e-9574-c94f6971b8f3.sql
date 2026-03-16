
-- Add Setup/Integrações specific columns
ALTER TABLE public.products
  ADD COLUMN subcategory TEXT,
  ADD COLUMN frequency TEXT DEFAULT 'unique';
