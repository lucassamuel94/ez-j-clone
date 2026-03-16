
CREATE TABLE public.whatsapp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone_or_id text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read groups"
ON public.whatsapp_groups FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Managers can manage groups"
ON public.whatsapp_groups FOR ALL TO authenticated
USING (is_manager(auth.uid()));
