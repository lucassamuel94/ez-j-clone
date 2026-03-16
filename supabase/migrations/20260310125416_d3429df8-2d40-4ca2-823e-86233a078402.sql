
-- Allow anonymous/public read access to products (public pricing data)
CREATE POLICY "Anyone can read products"
ON public.products FOR SELECT
TO anon
USING (true);
