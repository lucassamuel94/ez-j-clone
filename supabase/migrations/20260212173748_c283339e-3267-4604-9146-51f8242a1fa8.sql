-- Add product_type column to proposals
ALTER TABLE public.proposals 
ADD COLUMN product_type text NOT NULL DEFAULT 'ez_chat';

-- Update existing proposals
UPDATE public.proposals SET product_type = 'ez_chat' WHERE product_type = 'ez_chat';