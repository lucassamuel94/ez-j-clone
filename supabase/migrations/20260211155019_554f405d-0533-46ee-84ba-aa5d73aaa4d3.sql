
-- Create products table for the product library
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL, -- 'ez_chat', 'ez_call', 'monitoria', 'setup_integracoes'
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  messages_included INTEGER NOT NULL DEFAULT 0,
  contacts_included INTEGER NOT NULL DEFAULT 0,
  excess_message_price NUMERIC NOT NULL DEFAULT 0,
  excess_contact_price NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  recommended BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view active products
CREATE POLICY "Authenticated users can view products"
ON public.products FOR SELECT
USING (true);

-- Only admins can insert
CREATE POLICY "Admins can insert products"
ON public.products FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- Only admins can update
CREATE POLICY "Admins can update products"
ON public.products FOR UPDATE
USING (is_admin(auth.uid()));

-- Only admins can delete
CREATE POLICY "Admins can delete products"
ON public.products FOR DELETE
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
